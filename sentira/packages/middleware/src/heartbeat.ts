/**
 * Heartbeat monitor — runs on an interval and fires sensor-offline alerts
 * for any node that has gone silent past the configured timeout.
 *
 * Silent sensor failure is unacceptable in this domain (spec §2: "a monitoring
 * system that loses power silently is worse than no system"). This module
 * makes node loss a visible, alertable event.
 */

import type { Alert } from "@sentira/types";
import type { MiddlewareConfig } from "./config.js";
import { logger } from "./logger.js";
import type { Store } from "./store.js";
import type { AlertManager } from "./alert-manager.js";

export class HeartbeatMonitor {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly store: Store,
    private readonly cfg: MiddlewareConfig,
    private readonly alerts: AlertManager,
  ) {}

  start(intervalMs = 15_000): void {
    this.timer = setInterval(() => this.tick(), intervalMs);
    logger.info({ intervalMs, timeoutSec: this.cfg.thresholds.heartbeatTimeoutSec }, "heartbeat monitor started");
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick(): Promise<void> {
    const now = Date.now();
    const timeoutMs = this.cfg.thresholds.heartbeatTimeoutSec * 1000;
    const knownNodes = new Set<string>();

    for (const resident of this.store.getResidents()) {
      for (const nodeId of resident.nodeIds) {
        knownNodes.add(nodeId);
        const health = this.store.getNode(nodeId);
        const lastSeen = health?.lastSeen ?? 0;
        const online = lastSeen > 0 && now - lastSeen < timeoutMs;

        // Update health online flag.
        if (health) {
          const wasOnline = health.online;
          if (wasOnline !== online) {
            this.store.upsertNode({ ...health, online });
          }
        }

        // Fire sensor-offline if it just went silent and there's no active alert yet.
        if (!online && lastSeen > 0 && !this.store.activeAlert(resident.id, "sensor_offline")) {
          logger.warn({ nodeId, residentId: resident.id, lastSeenAgoSec: Math.round((now - lastSeen) / 1000) }, "node silent — firing sensor_offline");
          const candidate: Omit<Alert, "id" | "createdAt" | "escalationCount" | "audit" | "status"> = {
            residentId: resident.id,
            residentName: resident.name,
            nodeId,
            room: resident.room,
            type: "sensor_offline",
            severity: "MEDIUM",
            message: `Sensor offline in ${resident.room} — ${nodeId} has not reported for ${Math.round((now - lastSeen) / 1000)}s. Please verify hardware.`,
            context: {
              detail: `Node ${nodeId} stopped reporting. Could indicate power loss, network drop, or hardware fault. Local detection for ${resident.name} is degraded until the node returns.`,
            },
          };
          await this.alerts.create(candidate);
        }
      }
    }
  }
}
