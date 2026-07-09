/**
 * Engine — wires the MQTT ingestor to the rules engine + alert manager.
 *
 * On every normalized {@link SensorReading}:
 *   1. Update node-health (presence, vitals, last motion, last-seen).
 *   2. Run the rules engine → zero or more AlertCandidates.
 *   3. For each candidate, create the alert via AlertManager (dedup is handled
 *      both in the rules and in the store's activeByKey index).
 *   4. Two-stage fall confirm: fall events are NOT fired immediately; they wait
 *      for a confirm window. If recovery motion is detected, the fall is cancelled.
 *      If the window expires with no recovery, the HIGH alert fires.
 *   5. Auto-resolve MEDIUM alerts when their underlying condition clears.
 */

import type { NodeHealth, SensorReading } from "@sentira/types";
import type { MiddlewareConfig } from "./config.js";
import { logger } from "./logger.js";
import type { Store } from "./store.js";
import { evaluateRules } from "./rules.js";
import type { AlertManager } from "./alert-manager.js";
import type { MqttIngestor } from "./mqtt.js";

export class Engine {
  /** Periodic check for expired pending falls (runs even without incoming readings). */
  private fallCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly store: Store,
    private readonly cfg: MiddlewareConfig,
    private readonly alerts: AlertManager,
    private readonly ingestor: MqttIngestor,
  ) {}

  async start(): Promise<void> {
    await this.ingestor.start();
    // Check expired pending falls every 5s so alerts fire promptly after confirm window
    this.fallCheckTimer = setInterval(() => this.checkExpiredFalls(), 5000);
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

    // 2. Fall two-stage confirm.
    //    Fall events are NOT passed as candidates. Engine records them as pending
    //    and fires the alert only after the confirm window with no recovery motion.
    if (reading.entity === "fall") {
      const resident = this.store.residentForNode(reading.nodeId);
      if (resident && !this.store.activeAlert(resident.id, "fall")) {
        this.store.pendingFalls.set(reading.nodeId, {
          timestamp: reading.timestamp,
          residentId: resident.id,
          nodeId: reading.nodeId,
          residentName: resident.name,
          room: resident.room,
          message: `Possible fall detected — please check on ${resident.name}.`,
          context: {
            detail: `Fall signal received, waiting ${resident.thresholds.fallConfirmWindowSec}s recovery window before confirming.`,
          },
        });
        logger.info({ nodeId: reading.nodeId, resident: resident.name }, "Fall event recorded — awaiting confirm window");
      }
      // Skip rule evaluation for fall events (no candidates from fallRule).
    }

    // 3. Recovery motion clears any pending fall.
    if ((reading.entity === "motion_level" || reading.entity === "motion_energy") && (reading.value ?? 0) > 12) {
      const cleared = this.store.pendingFalls.get(reading.nodeId);
      if (cleared) {
        this.store.pendingFalls.delete(reading.nodeId);
        logger.info({ nodeId: reading.nodeId }, "Recovery motion detected — pending fall cleared");
      }
    }

    // 4. Check expired pending falls (confirm window elapsed).
    this.checkExpiredFalls();

    // 5. Fire new alerts from other rules (skip fall — handled above).
    for (const candidate of result.candidates) {
      if (candidate.type === "fall") continue; // handled by two-stage confirm
      if (this.store.activeAlert(candidate.residentId, candidate.type)) continue;
      logger.info({ type: candidate.type, severity: candidate.severity, resident: candidate.residentName }, "alert candidate → creating");
      await this.alerts.create(candidate).catch((err) => {
        logger.error({ err, type: candidate.type }, "Failed to create alert");
      });
    }

    // 6. Auto-resolve MEDIUM alerts when their underlying condition clears.
    const resident = this.store.residentForNode(reading.nodeId);
    if (resident) {
      // sensor_offline → node resumed reporting.
      const offline = this.store.activeAlert(resident.id, "sensor_offline");
      if (offline) {
        this.alerts.maybeAutoResolve(offline.id, `Node ${reading.nodeId} resumed reporting.`);
      }
      // breathing_trend → breathing returned to normal range.
      if (reading.entity === "breathing_rate" && typeof reading.value === "number") {
        const [lo, hi] = resident.thresholds.breathingRange;
        if (reading.value >= lo && reading.value <= hi) {
          const trend = this.store.activeAlert(resident.id, "breathing_trend");
          if (trend) this.alerts.maybeAutoResolve(trend.id, "Breathing rate returned to normal range.");
        }
      }
      // unusual_activity → anomaly flag cleared.
      if (reading.entity === "elderly_inactivity_anomaly" && reading.state === false) {
        const unusual = this.store.activeAlert(resident.id, "unusual_activity");
        if (unusual) this.alerts.maybeAutoResolve(unusual.id, "Activity pattern returned to baseline.");
      }
    }
  };

  /** Fire alerts for pending falls whose confirm window has expired. */
  private checkExpiredFalls(): void {
    const now = Date.now();
    for (const [nodeId, pending] of this.store.pendingFalls) {
      const resident = this.store.residentForNode(nodeId);
      if (!resident) {
        this.store.pendingFalls.delete(nodeId);
        continue;
      }
      const windowMs = resident.thresholds.fallConfirmWindowSec * 1000;
      if (now - pending.timestamp >= windowMs) {
        this.store.pendingFalls.delete(nodeId);
        // Two-stage confirmed: no recovery motion within the window.
        const context = {
          ...pending.context,
          secondsSinceMotion: Math.round((now - (this.store.getNode(nodeId)?.lastMotion ?? now)) / 1000),
          detail: `No recovery motion within ${resident.thresholds.fallConfirmWindowSec}s confirm window — two-stage confirmed.`,
        };
        const candidate = {
          residentId: pending.residentId,
          residentName: pending.residentName,
          nodeId: pending.nodeId,
          room: pending.room,
          type: "fall" as const,
          severity: "HIGH" as const,
          message: pending.message,
          context,
        };
        logger.info({ nodeId, resident: pending.residentName }, "Fall two-stage confirmed → creating alert");
        this.alerts.create(candidate).catch((err) => {
          logger.error({ err, nodeId }, "Failed to create fall alert");
        });
      }
    }
  }

  /** Clean up on shutdown. */
  stop(): void {
    if (this.fallCheckTimer !== null) {
      clearInterval(this.fallCheckTimer);
      this.fallCheckTimer = null;
    }
  }
}
