/**
 * Thin async wrapper around mqtt.js for publishing RuView-shaped messages.
 * Keeps the rest of the package free of client-lifecycle concerns.
 */

import mqtt, { type IClientOptions, type MqttClient } from "mqtt";
import { type Component, type EntitySlug, type TopicParts, baseTopic, configTopic, stateTopic, availabilityTopic } from "./topics.js";

export interface PublisherConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  prefix: string;
  nodeId: string;
  friendlyName: string;
  swVersion: string;
}

export class RuViewPublisher {
  private client: MqttClient | null = null;
  private readonly cfg: PublisherConfig;

  constructor(cfg: PublisherConfig) {
    this.cfg = cfg;
  }

  get nodeId(): string {
    return this.cfg.nodeId;
  }

  async connect(): Promise<void> {
    const url = `mqtt://${this.cfg.host}:${this.cfg.port}`;
    const opts: IClientOptions = {
      clientId: `sentira-mock-${this.cfg.nodeId}-${Math.random().toString(16).slice(2, 8)}`,
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: 5000,
      ...(this.cfg.username ? { username: this.cfg.username, password: this.cfg.password } : {}),
    };
    return new Promise((resolve, reject) => {
      const client = mqtt.connect(url, opts);
      this.client = client;
      client.on("connect", () => resolve());
      client.on("error", (err) => reject(err));
    });
  }

  /** Publish the full HA discovery tree once (retained configs + online availability). */
  async publishDiscovery(
    entities: ReadonlyArray<{ slug: EntitySlug; component: Component }>,
    buildConfig: (p: { slug: EntitySlug; component: Component }) => Record<string, unknown> | object,
  ): Promise<void> {
    const c = this.require();
    for (const e of entities) {
      const parts: TopicParts = {
        prefix: this.cfg.prefix,
        component: e.component,
        nodeId: this.cfg.nodeId,
        slug: e.slug,
      };
      // Config — retained so late subscribers pick it up.
      await this.publish(configTopic(parts), JSON.stringify(buildConfig(e)), { retain: true, qos: 1 });
      // Availability — retained so HA / middleware see "online" on connect.
      await this.publish(availabilityTopic(parts), "online", { retain: true, qos: 1 });
    }
    c.publish(`${this.cfg.prefix}/sensor/${this.cfg.nodeId}/availability`, "online", { retain: true, qos: 1 });
  }

  /** Publish one tick's emissions. */
  async publishState(emissions: ReadonlyArray<{ slug: EntitySlug; component: Component; value?: number; binary?: boolean | "trigger" }>, ts = Date.now()): Promise<void> {
    for (const e of emissions) {
      const parts: TopicParts = {
        prefix: this.cfg.prefix,
        component: e.component,
        nodeId: this.cfg.nodeId,
        slug: e.slug,
      };
      const payload = encodePayload(e.slug, e.value, e.binary, ts);
      await this.publish(stateTopic(parts), payload, { retain: false, qos: 0 });
    }
  }

  /** Announce offline (LWT-style). */
  async goOffline(): Promise<void> {
    const c = this.require();
    const topics = [
      `${this.cfg.prefix}/binary_sensor/${this.cfg.nodeId}/presence/availability`,
      `${this.cfg.prefix}/sensor/${this.cfg.nodeId}/breathing_rate/availability`,
      `${this.cfg.prefix}/sensor/${this.cfg.nodeId}/heart_rate/availability`,
    ];
    for (const t of topics) {
      await this.publish(t, "offline", { retain: true, qos: 1 });
    }
    c.publish(`${this.cfg.prefix}/sensor/${this.cfg.nodeId}/availability`, "offline", { retain: true, qos: 1 });
  }

  async disconnect(): Promise<void> {
    await this.goOffline();
    return new Promise((resolve) => {
      const c = this.require();
      c.end(true, () => resolve());
    });
  }

  private publish(topic: string, payload: string, opts: { retain?: boolean; qos?: 0 | 1 | 2 }): Promise<void> {
    return new Promise((resolve, reject) => {
      const c = this.require();
      c.publish(topic, payload, opts, (err) => (err ? reject(err) : resolve()));
    });
  }

  private require(): MqttClient {
    if (!this.client) throw new Error("RuViewPublisher: call connect() first");
    return this.client;
  }
}

/**
 * Encode payload matching real RuView firmware format:
 *   sensor:    {"bpm":14.2,"confidence":0.87,"ts":"..."}
 *   event:     {"event_type":"fall_detected","ts":"...","confidence":0.87}
 *   binary:    ON / OFF (backward compat)
 *   bare number: fallback (backward compat with old mock)
 */
function encodePayload(slug: EntitySlug, value: number | undefined, binary: boolean | "trigger" | undefined, ts: number): string {
  // Events — use real firmware event_type values
  if (binary === "trigger" || slug === "fall" || slug === "bed_exit" || slug === "multi_room_transition") {
    const eventMap: Partial<Record<EntitySlug, string>> = {
      fall: "fall_detected",
      bed_exit: "bed_exit",
      multi_room_transition: "transition",
    };
    return JSON.stringify({
      event_type: eventMap[slug] ?? "trigger",
      ts: new Date(ts).toISOString(),
      confidence: 0.87,
    });
  }

  // Binary — HA-style ON/OFF
  if (binary === true) return "ON";
  if (binary === false) return "OFF";

  // Numeric sensors — real firmware JSON field mapping
  const fieldMap: Partial<Record<EntitySlug, string>> = {
    breathing_rate: "bpm",
    heart_rate: "bpm",
    motion_level: "level_pct",
    motion_energy: "level_pct",
    rssi: "dbm",
    person_count: "n_persons",
    presence_score: "score",
    fall_risk_elevated: "score",
  };
  if (typeof value === "number") {
    const field = fieldMap[slug];
    if (field) {
      return JSON.stringify({
        [field]: value,
        ts: new Date(ts).toISOString(),
      });
    }
  }

  // Fallback: bare number or empty
  if (typeof value === "number") return String(value);
  return "";
}

/** Convenience: where a resident's "room-active" status would live. */
export function roomActiveTopic(prefix: string, nodeId: string): string {
  return baseTopic({ prefix, component: "binary_sensor", nodeId, slug: "room_active" });
}
