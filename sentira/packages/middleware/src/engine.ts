/**
 * Engine — wires the MQTT ingestor to the rules engine + alert manager.
 *
 * On every normalized {@link SensorReading}:
 *   1. Update node-health (presence, vitals, last motion, last-seen).
 *   2. Run the rules engine → zero or more AlertCandidates.
 *   3. For each candidate, create the alert via AlertManager (dedup is handled
 *      both in the rules and in the store's activeByKey index).
 *   4. Auto-resolve MEDIUM alerts when their underlying condition clears.
 */

import type { NodeHealth, SensorReading } from "@sentira/types";
import type { MiddlewareConfig } from "./config.js";
import { logger } from "./logger.js";
import type { Store } from "./store.js";
import { evaluateRules } from "./rules.js";
import type { AlertManager } from "./alert-manager.js";
import type { MqttIngestor } from "./mqtt.js";

export class Engine {
  constructor(
    private readonly store: Store,
    private readonly cfg: MiddlewareConfig,
    private readonly alerts: AlertManager,
    private readonly ingestor: MqttIngestor,
  ) {}

  async start(): Promise<void> {
    await this.ingestor.start();
    logger.info("engine started — processing readings");
  }

  /** Called for every reading; also exposed so unit tests can drive it directly. */
  onReading = async (reading: SensorReading): Promise<void> => {
    // 1. Update node health (merge with existing).
    const existing = this.store.getNode(reading.nodeId);
    const baseHealth: NodeHealth = existing ?? {
      nodeId: reading.nodeId,
      lastSeen: reading.timestamp,
      online: true,
      presence: false,
      lastMotion: reading.timestamp,
    };
    const result = evaluateRules(reading, { now: reading.timestamp, store: this.store, config: this.cfg });
    const patch = result.healthPatch ?? { nodeId: reading.nodeId };
    this.store.upsertNode({
      ...baseHealth,
      lastSeen: reading.timestamp,
      online: true,
      ...patch,
    });

    // 2-3. Fire new alerts.
    for (const candidate of result.candidates) {
      if (this.store.activeAlert(candidate.residentId, candidate.type)) continue;
      logger.info({ type: candidate.type, severity: candidate.severity, resident: candidate.residentName }, "alert candidate → creating");
      await this.alerts.create(candidate);
    }

    // 4. Auto-resolve sensor_offline when a node resumes reporting.
    const resident = this.store.residentForNode(reading.nodeId);
    if (resident) {
      const offline = this.store.activeAlert(resident.id, "sensor_offline");
      if (offline) {
        this.alerts.maybeAutoResolve(offline.id, `Node ${reading.nodeId} resumed reporting.`);
      }
    }
  };
}
