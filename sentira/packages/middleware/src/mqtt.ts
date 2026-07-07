/**
 * MQTT subscriber — ingests RuView's sensing-server state topics and
 * normalizes them into typed {@link SensorReading} objects the rules
 * engine consumes.
 *
 * Subscribes broadly to:
 *   <prefix>/+/+/+/state
 * then filters by nodePrefix substring match in parseTopic().
 *
 * RuView sensing-server (the active code-path) publishes:
 *   homeassistant/<component>/wifi_densepose_<mac>/<slug>/state
 *
 * We only care about /state messages; HA discovery configs are ignored
 * (the entity taxonomy is hard-coded from @sentira/types).
 */

import mqtt, { type IClientOptions, type MqttClient } from "mqtt";
import type { SensorReading, RuViewEntityKind } from "@sentira/types";
import type { MiddlewareConfig } from "./config.js";
import { logger } from "./logger.js";
import type { Store } from "./store.js";

export type ReadingHandler = (reading: SensorReading) => void;

const KNOWN_ENTITIES = new Set<string>([
  "presence", "person_count", "breathing_rate", "heart_rate", "motion_level",
  "motion_energy", "fall", "presence_score", "rssi", "zone_occupancy", "pose",
  "someone_sleeping", "possible_distress", "room_active",
  "elderly_inactivity_anomaly", "meeting_in_progress", "bathroom_occupied",
  "fall_risk_elevated", "bed_exit", "no_movement", "multi_room_transition",
]);

export class MqttIngestor {
  private client: MqttClient | null = null;
  /** Mutable so the engine can rewire it once it exists. */
  onReading: ReadingHandler;

  constructor(
    private readonly cfg: MiddlewareConfig,
    private readonly store: Store,
    onReading: ReadingHandler = () => undefined,
  ) {
    this.onReading = onReading;
  }

  async start(): Promise<void> {
    const { host, port, username, password, discoveryPrefix, nodePrefix } = this.cfg.mqtt;
    const url = `mqtt://${host}:${port}`;
    const opts: IClientOptions = {
      clientId: `sentira-middleware-${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: 5000,
      ...(username ? { username, password } : {}),
    };

    return new Promise((resolve) => {
      const client = mqtt.connect(url, opts);
      this.client = client;
      // Resolve immediately so the engine/server can boot regardless of MQTT.
      // mqtt.js auto-reconnects; subscriptions are set up on first 'connect'.
      resolve();

      client.on("connect", () => {
        // Subscribe broadly to all HA-discovery state topics; parseTopic
        // filters by nodePrefix in code. MQTT does not support prefix
        // wildcards (*), so we use + for the component and slug levels.
        const topic = `${discoveryPrefix}/+/+/+/state`;
        client.subscribe(topic, { qos: 0 }, (err) => {
          if (err) {
            logger.error({ err, topic }, "MQTT subscribe failed");
          } else {
            logger.info({ topic, nodePrefix }, "MQTT subscribed — filtering state topics by node prefix");
          }
        });
      });

      client.on("message", (topic, payload) => this.handleMessage(topic, payload));
      client.on("error", (err) => logger.warn({ err }, "MQTT client error"));
      client.on("reconnect", () => logger.info("MQTT reconnecting..."));
      client.on("offline", () => logger.warn("MQTT broker offline"));
      client.on("close", () => logger.info("MQTT connection closed"));
    });
  }

  private handleMessage(topic: string, payload: Buffer): void {
    const parsed = parseTopic(topic, this.cfg.mqtt.discoveryPrefix, this.cfg.mqtt.nodePrefix);
    if (!parsed) return;

    if (!KNOWN_ENTITIES.has(parsed.slug)) return;

    const body = payload.toString("utf8");
    const reading = decodeReading(parsed, body);
    if (!reading) return;

    this.store.recordReading(reading);
    this.onReading(reading);
  }

  async stop(): Promise<void> {
    if (!this.client) return;
    return new Promise((resolve) => this.client!.end(true, () => resolve()));
  }
}

interface ParsedTopic {
  nodeId: string;
  slug: string;
}

function parseTopic(topic: string, prefix: string, nodePrefix: string): ParsedTopic | undefined {
  // homeassistant/<component>/<node_id>/<slug>/state
  const parts = topic.split("/");
  if (parts.length !== 5) return undefined;
  if (parts[0] !== prefix) return undefined;
  if (parts[4] !== "state") return undefined;
  const nodeId = parts[2]!;
  if (!nodeId.includes(nodePrefix.replace(/^\*/, "")) && !nodePrefix.includes("*")) {
    // When the prefix has no wildcard, do a substring match.
    if (!nodeId.includes(nodePrefix)) return undefined;
  } else if (!nodeId.includes(nodePrefix.replace(/\*/g, ""))) {
    return undefined;
  }
  return { nodeId, slug: parts[3]! };
}

function decodeReading(parsed: ParsedTopic, body: string): SensorReading | undefined {
  const entity = parsed.slug as RuViewEntityKind;
  const trimmed = body.trim();
  const timestamp = Date.now();
  const raw = trimmed;

  // Event entities (fall / bed_exit / multi_room_transition) arrive as JSON.
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      return { timestamp, nodeId: parsed.nodeId, entity, state: obj.event_type === "trigger", raw };
    } catch {
      return undefined;
    }
  }

  // Binary sensors → ON / OFF.
  const upper = trimmed.toUpperCase();
  if (upper === "ON") return { timestamp, nodeId: parsed.nodeId, entity, state: true, raw };
  if (upper === "OFF") return { timestamp, nodeId: parsed.nodeId, entity, state: false, raw };

  // Numeric sensors.
  const value = Number(trimmed);
  if (Number.isFinite(value)) {
    const unit = unitFor(entity);
    return { timestamp, nodeId: parsed.nodeId, entity, value, unit, raw };
  }

  return undefined;
}

function unitFor(entity: RuViewEntityKind): string | undefined {
  if (entity === "breathing_rate" || entity === "heart_rate") return "bpm";
  if (entity === "rssi") return "dBm";
  return undefined;
}
