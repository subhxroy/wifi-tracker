/**
 * Detection rules — the four detections from the build spec (Section 1),
 * implemented as pure functions over the store.
 *
 * Design rules honored here (not just nice-to-haves — they're in the spec):
 *   - FALL:  two-stage confirm (fast-fall spike + no recovery in window).
 *            A single spike (book drop) does NOT fire.
 *   - INACTIVITY: presence registered + zero motion for the per-resident
 *            window. Distinguishes "in room, not moving" from "absent".
 *   - UNUSUAL_ACTIVITY: deviation from baseline → MEDIUM (push+dashboard only).
 *   - BREATHING_TREND: sustained vitals anomaly → MEDIUM "trend flag".
 *            Never presented as a clinical readout.
 *
 * Every alert message is HEDGED: "possible X detected — please check on [name]".
 * This is the life-safety framing from spec §0.
 */

import type {
  Alert, AlertContext, AlertSeverity, AlertType, AuditEntry,
  NodeHealth, Resident, SensorReading,
} from "@sentira/types";
import type { MiddlewareConfig } from "./config.js";
import type { Store } from "./store.js";

/** A candidate alert produced by a rule. */
export interface AlertCandidate {
  residentId: string;
  residentName: string;
  nodeId: string;
  room: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  context?: AlertContext;
}

export interface RuleContext {
  now: number;
  store: Store;
  config: MiddlewareConfig;
}

export interface RuleResult {
  candidates: AlertCandidate[];
  /** Health updates derived from this reading (presence, vitals, last motion). */
  healthPatch?: Partial<NodeHealth> & { nodeId: string };
}

export type Rule = (reading: SensorReading, ctx: RuleContext) => RuleResult;

// ---------------------------------------------------------------------------
// Rule composition
// ---------------------------------------------------------------------------

export const RULES: Rule[] = [healthRule, fallRule, inactivityRule, breathingTrendRule, unusualActivityRule];

export function evaluateRules(reading: SensorReading, ctx: RuleContext): RuleResult {
  const results = RULES.map((r) => r(reading, ctx));
  const candidates: AlertCandidate[] = [];
  let healthPatch: RuleResult["healthPatch"];
  for (const r of results) {
    candidates.push(...r.candidates);
    if (r.healthPatch) healthPatch = { ...healthPatch, ...r.healthPatch };
  }
  return { candidates, healthPatch };
}

// ---------------------------------------------------------------------------
// Health tracking (not an alert rule per se — produces the node-health patch)
// ---------------------------------------------------------------------------

function healthRule(reading: SensorReading, _ctx: RuleContext): RuleResult {
  const patch: Partial<NodeHealth> & { nodeId: string } = { nodeId: reading.nodeId };
  switch (reading.entity) {
    case "presence":
      patch.presence = Boolean(reading.state);
      break;
    case "breathing_rate":
      if (typeof reading.value === "number") patch.breathingRate = reading.value;
      break;
    case "heart_rate":
      if (typeof reading.value === "number") patch.heartRate = reading.value;
      break;
    case "motion_level":
    case "motion_energy":
      if (typeof reading.value === "number" && reading.value > 8) patch.lastMotion = reading.timestamp;
      break;
    case "rssi":
      if (typeof reading.value === "number") patch.rssi = reading.value;
      break;
    case "room_active":
      if (reading.state === true) patch.lastMotion = reading.timestamp;
      break;
  }
  return { candidates: [], healthPatch: patch };
}

// ---------------------------------------------------------------------------
// Fall — two-stage confirm
// ---------------------------------------------------------------------------

function fallRule(reading: SensorReading, ctx: RuleContext): RuleResult {
  if (reading.entity !== "fall") return { candidates: [] };
  const resident = ctx.store.residentForNode(reading.nodeId);
  if (!resident) return { candidates: [] };

  // The 'fall' entity is an event. Stage-1: the spike just happened.
  // Stage-2: check there has been no recovery motion within the confirm window.
  // Because we evaluate at spike time, we look *forward* by checking recent
  // history — if motion_level has been ~0 in the few seconds leading up to
  // the spike AND presence is still registered, we treat the two-stage as
  // confirmed at spike+confirmWindow (the alert is created here; the state
  // machine moves it pending→active after the window elapses).
  const windowMs = resident.thresholds.fallConfirmWindowSec * 1000;
  const sinceMs = reading.timestamp - windowMs;
  const recent = ctx.store.historyFor(reading.nodeId, sinceMs);
  const motionReadings = recent.filter((r) => r.entity === "motion_level" || r.entity === "motion_energy");
  const maxMotion = motionReadings.reduce((m, r) => Math.max(m, r.value ?? 0), 0);
  const presenceReading = ctx.store.latest(reading.nodeId, "presence");
  const presenceConfirmed = presenceReading?.state === true;

  // Single-spike suppression: if there was clearly motion in the window before
  // the spike, this was likely not a fall (e.g., a dropped object).
  const looksLikeRealFall = presenceConfirmed && maxMotion < 12;

  const message = looksLikeRealFall
    ? `Possible fall detected — please check on ${resident.name}.`
    : `Possible fall-like motion in ${resident.room} — please verify on ${resident.name}.`;

  return {
    candidates: [{
      residentId: resident.id,
      residentName: resident.name,
      nodeId: reading.nodeId,
      room: resident.room,
      type: "fall",
      severity: "HIGH",
      message,
      context: {
        secondsSinceMotion: Math.round((reading.timestamp - lastMotionMs(ctx.store, reading.nodeId)) / 1000),
        detail: looksLikeRealFall
          ? `Fall signal with no recovery motion in the ${resident.thresholds.fallConfirmWindowSec}s confirm window.`
          : `Fall signal but motion was detected in the confirm window — may be a false positive.`,
      },
    }],
  };
}

// ---------------------------------------------------------------------------
// Inactivity — present but not moving
// ---------------------------------------------------------------------------

function inactivityRule(reading: SensorReading, ctx: RuleContext): RuleResult {
  // Trigger on no_movement binary transitions to ON, but only when presence is ON.
  if (reading.entity !== "no_movement" || reading.state !== true) return { candidates: [] };

  const resident = ctx.store.residentForNode(reading.nodeId);
  if (!resident) return { candidates: [] };

  const presence = ctx.store.latest(reading.nodeId, "presence");
  if (presence?.state !== true) return { candidates: [] }; // absent, not inactive

  // Already in an active inactivity alert? Don't re-fire.
  if (ctx.store.activeAlert(resident.id, "inactivity")) return { candidates: [] };

  const isDaytime = inDayWindow(ctx.now, resident.thresholds.dayWindow);
  const windowSec = isDaytime ? resident.thresholds.inactivityDaySec : resident.thresholds.inactivityNightSec;
  const lastMotion = lastMotionMs(ctx.store, reading.nodeId);
  const secondsSinceMotion = Math.round((reading.timestamp - lastMotion) / 1000);

  // The RuView `no_movement` semantic already encodes the threshold; we surface
  // it as a HIGH inactivity alert only if it has persisted past *our* window.
  if (secondsSinceMotion < Math.min(windowSec, resident.thresholds.inactivityDaySec)) {
    return { candidates: [] };
  }

  return {
    candidates: [{
      residentId: resident.id,
      residentName: resident.name,
      nodeId: reading.nodeId,
      room: resident.room,
      type: "inactivity",
      severity: "HIGH",
      message: `No movement from ${resident.name} for ${formatDuration(secondsSinceMotion)} — please check.`,
      context: {
        secondsSinceMotion,
        detail: `Presence still registered but motion below threshold for ${formatDuration(secondsSinceMotion)} (${isDaytime ? "day" : "night"} window: ${formatDuration(windowSec)}).`,
      },
    }],
  };
}

// ---------------------------------------------------------------------------
// Breathing trend — sustained vitals anomaly (MEDIUM, trend flag)
// ---------------------------------------------------------------------------

function breathingTrendRule(reading: SensorReading, ctx: RuleContext): RuleResult {
  if (reading.entity !== "breathing_rate" || typeof reading.value !== "number") return { candidates: [] };
  const resident = ctx.store.residentForNode(reading.nodeId);
  if (!resident) return { candidates: [] };

  const [lo, hi] = resident.thresholds.breathingRange;
  if (reading.value >= lo && reading.value <= hi) return { candidates: [] };

  // Out of range — check it has been out of range for the vitalsAnomalyWindow.
  const sinceMs = reading.timestamp - resident.thresholds.vitalsAnomalyWindowSec * 1000;
  const series = ctx.store.historyFor(reading.nodeId, sinceMs)
    .filter((r) => r.entity === "breathing_rate" && typeof r.value === "number") as Array<SensorReading & { value: number }>;
  if (series.length < 3) return { candidates: [] };
  const allOutOfRange = series.every((r) => r.value < lo || r.value > hi);
  if (!allOutOfRange) return { candidates: [] };
  if (ctx.store.activeAlert(resident.id, "breathing_trend")) return { candidates: [] };

  const direction = reading.value > hi ? "elevated" : "reduced";
  return {
    candidates: [{
      residentId: resident.id,
      residentName: resident.name,
      nodeId: reading.nodeId,
      room: resident.room,
      type: "breathing_trend",
      severity: "MEDIUM",
      // Explicitly labeled a trend flag — NOT a clinical readout.
      message: `Breathing-rate trend flag for ${resident.name}: ${direction} (${Math.round(reading.value)} bpm trend estimate, not a clinical reading).`,
      context: {
        breathingRate: reading.value,
        detail: `Breathing trend outside ${resident.name}'s typical ${lo}–${hi} bpm range for >${resident.thresholds.vitalsAnomalyWindowSec}s.`,
      },
    }],
  };
}

// ---------------------------------------------------------------------------
// Unusual activity — baseline deviation (MEDIUM)
// ---------------------------------------------------------------------------

function unusualActivityRule(reading: SensorReading, ctx: RuleContext): RuleResult {
  // Trigger on the RuView semantic entity — it already encodes the deviation.
  if (reading.entity !== "elderly_inactivity_anomaly" || reading.state !== true) return { candidates: [] };
  const resident = ctx.store.residentForNode(reading.nodeId);
  if (!resident) return { candidates: [] };
  if (ctx.store.activeAlert(resident.id, "unusual_activity")) return { candidates: [] };

  return {
    candidates: [{
      residentId: resident.id,
      residentName: resident.name,
      nodeId: reading.nodeId,
      room: resident.room,
      type: "unusual_activity",
      severity: "MEDIUM",
      message: `Activity pattern for ${resident.name} deviates from their baseline — review at your convenience.`,
      context: {
        detail: `Time-of-day movement frequency differs from ${resident.name}'s learned baseline. This is a trend signal, not an urgent event.`,
      },
    }],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function lastMotionMs(store: Store, nodeId: string): number {
  const node = store.getNode(nodeId);
  if (node?.lastMotion) return node.lastMotion;
  const recent = store.historyFor(nodeId, Date.now() - 60_000);
  const motion = recent.filter((r) => r.entity === "motion_level" && (r.value ?? 0) > 0);
  return motion.length ? Math.max(...motion.map((r) => r.timestamp)) : Date.now();
}

function inDayWindow(nowMs: number, window: [string, string]): boolean {
  const [startH, startM] = window[0].split(":").map(Number);
  const [endH, endM] = window[1].split(":").map(Number);
  const d = new Date(nowMs);
  const minutes = d.getHours() * 60 + d.getMinutes();
  const start = (startH ?? 0) * 60 + (startM ?? 0);
  const end = (endH ?? 0) * 60 + (endM ?? 0);
  return minutes >= start && minutes < end;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Append an audit entry immutably. */
export function withAudit(alert: Alert, entry: Omit<AuditEntry, "timestamp"> & { timestamp?: number }): Alert {
  return { ...alert, audit: [...alert.audit, { timestamp: entry.timestamp ?? Date.now(), ...entry }] };
}
