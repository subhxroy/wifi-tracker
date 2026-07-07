/**
 * In-memory store + internal event bus.
 *
 * Holds residents, alerts, node-health, and the rolling per-node sensor
 * history the rules engine reads from. Emits a typed event whenever state
 * changes so the SSE endpoint can fan out to dashboards with zero polling.
 *
 * This is deliberately a single-process store — fine for the local / single-
 * site deployment. The Firestore-backed variant (same interface) is the
 * production swap; see docs/ARCHITECTURE.md.
 */

import type {
  Alert, NodeHealth, OverviewSnapshot, Resident, SensorReading,
} from "@sentira/types";
import { nanoid } from "nanoid";

export type StoreEvent =
  | { kind: "alert_created"; alert: Alert }
  | { kind: "alert_updated"; alert: Alert }
  | { kind: "node_health"; node: NodeHealth }
  | { kind: "overview"; snapshot: OverviewSnapshot };

type Listener = (e: StoreEvent) => void;

const MAX_HISTORY_PER_NODE = 600; // ~20 min at 2s intervals

export class Store {
  private residents = new Map<string, Resident>();
  private alerts = new Map<string, Alert>();
  /** Active (non-resolved) alerts keyed by `${residentId}:${type}` for dedup. */
  private activeByKey = new Map<string, Alert>();
  private nodeHealth = new Map<string, NodeHealth>();
  private history = new Map<string, SensorReading[]>();
  private listeners = new Set<Listener>();

  constructor(seed: Resident[]) {
    for (const r of seed) this.residents.set(r.id, r);
  }

  // --- subscribers ---
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(e: StoreEvent): void {
    for (const l of this.listeners) {
      try { l(e); } catch { /* listener errors must not break the store */ }
    }
  }

  // --- residents ---
  getResidents(): Resident[] { return [...this.residents.values()]; }
  getResident(id: string): Resident | undefined { return this.residents.get(id); }
  residentForNode(nodeId: string): Resident | undefined {
    for (const r of this.residents.values()) {
      if (r.nodeIds.includes(nodeId)) return r;
    }
    return undefined;
  }
  upsertResident(r: Resident): void {
    r.updatedAt = Date.now();
    this.residents.set(r.id, r);
    this.emitOverview();
  }

  // --- sensor history ---
  recordReading(reading: SensorReading): void {
    const arr = this.history.get(reading.nodeId) ?? [];
    arr.push(reading);
    if (arr.length > MAX_HISTORY_PER_NODE) arr.shift();
    this.history.set(reading.nodeId, arr);
  }

  historyFor(nodeId: string, sinceMs: number): SensorReading[] {
    const arr = this.history.get(nodeId) ?? [];
    return arr.filter((r) => r.timestamp >= sinceMs);
  }

  /** Most recent reading of a given entity for a node. */
  latest(nodeId: string, entity: SensorReading["entity"]): SensorReading | undefined {
    const arr = this.history.get(nodeId);
    if (!arr) return undefined;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i]!.entity === entity) return arr[i];
    }
    return undefined;
  }

  // --- node health ---
  upsertNode(node: NodeHealth): void {
    this.nodeHealth.set(node.nodeId, node);
    this.emit({ kind: "node_health", node });
  }
  getNode(nodeId: string): NodeHealth | undefined { return this.nodeHealth.get(nodeId); }
  allNodes(): NodeHealth[] { return [...this.nodeHealth.values()]; }

  // --- alerts ---
  createAlert(input: Omit<Alert, "id" | "createdAt" | "escalationCount" | "audit" | "status"> & { status?: Alert["status"] }): Alert {
    const now = Date.now();
    const alert: Alert = {
      ...input,
      id: `alt_${nanoid(10)}`,
      status: input.status ?? "active",
      createdAt: now,
      escalationCount: 0,
      audit: [{ timestamp: now, action: "created", actor: "system", detail: input.message }],
    };
    this.alerts.set(alert.id, alert);
    this.activeByKey.set(`${alert.residentId}:${alert.type}`, alert);
    this.emit({ kind: "alert_created", alert });
    this.emitOverview();
    return alert;
  }

  updateAlert(id: string, patch: (a: Alert) => Alert): Alert | undefined {
    const cur = this.alerts.get(id);
    if (!cur) return undefined;
    const next = patch(cur);
    this.alerts.set(id, next);
    this.activeByKey.set(`${next.residentId}:${next.type}`, next);
    if (next.status === "resolved" || next.status === "false_alarm") {
      this.activeByKey.delete(`${next.residentId}:${next.type}`);
    }
    this.emit({ kind: "alert_updated", alert: next });
    this.emitOverview();
    return next;
  }

  getAlert(id: string): Alert | undefined { return this.alerts.get(id); }
  listAlerts(opts: { residentId?: string; includeResolved?: boolean; limit?: number } = {}): Alert[] {
    let arr = [...this.alerts.values()];
    if (opts.residentId) arr = arr.filter((a) => a.residentId === opts.residentId);
    if (!opts.includeResolved) arr = arr.filter((a) => a.status !== "resolved" && a.status !== "false_alarm");
    arr.sort((a, b) => b.createdAt - a.createdAt);
    return arr.slice(0, opts.limit ?? 200);
  }

  /** Active alert for a resident+type, if any (used by the rules engine for dedup). */
  activeAlert(residentId: string, type: Alert["type"]): Alert | undefined {
    return this.activeByKey.get(`${residentId}:${type}`);
  }

  allActiveAlerts(): Alert[] {
    return [...this.activeByKey.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  private emitOverview(): void {
    this.emit({ kind: "overview", snapshot: this.overview() });
  }

  overview(): OverviewSnapshot {
    const now = Date.now();
    return {
      generatedAt: now,
      residents: this.getResidents().map((r) => {
        const nodeIds = r.nodeIds;
        const nodes = nodeIds.map((id) => this.nodeHealth.get(id)).filter(Boolean) as NodeHealth[];
        const sensorOnline = nodes.length > 0 && nodes.every((n) => n.online);
        const sensorLastSeen = nodes.length ? Math.max(...nodes.map((n) => n.lastSeen)) : undefined;
        const active = this.allActiveAlerts().find((a) => a.residentId === r.id && (a.status === "active" || a.status === "escalated"));
        const highActive = this.allActiveAlerts().find((a) => a.residentId === r.id && a.severity === "HIGH" && (a.status === "active" || a.status === "escalated"));
        const breath = nodes.length ? nodes[nodes.length - 1]?.breathingRate : undefined;
        const heart = nodes.length ? nodes[nodes.length - 1]?.heartRate : undefined;
        return {
          id: r.id, name: r.name, room: r.room,
          status: highActive ? "alert" : active ? "attention" : "normal",
          activeAlertId: active?.id, activeAlertType: active?.type,
          sensorOnline, sensorLastSeen,
          breathingRate: breath, heartRate: heart,
        };
      }),
    };
  }
}
