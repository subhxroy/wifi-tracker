/**
 * @sentira/types — the single source of truth shared by middleware + dashboard.
 *
 * ⚠️  Sentira is a SUPPLEMENTAL alert layer, not a medical device. Every value
 * that touches vitals is a TREND ESTIMATE, never a clinical readout.
 */

// ---------------------------------------------------------------------------
// RuView integration contract
// ---------------------------------------------------------------------------

/**
 * Entity kinds RuView publishes via MQTT (HA auto-discovery).
 * Source of truth: ruview/v2/crates/wifi-densepose-sensing-server/src/mqtt/discovery.rs
 *
 * The middleware subscribes to:
 *   <prefix>/<component>/<node_id>/<slug>/state
 * and normalizes into {@link SensorReading}.
 */
export type RuViewEntityKind =
  | "presence"
  | "person_count"
  | "breathing_rate"
  | "heart_rate"
  | "motion_level"
  | "motion_energy"
  | "fall"
  | "presence_score"
  | "rssi"
  | "zone_occupancy"
  | "pose"
  | "someone_sleeping"
  | "possible_distress"
  | "room_active"
  | "elderly_inactivity_anomaly"
  | "meeting_in_progress"
  | "bathroom_occupied"
  | "fall_risk_elevated"
  | "bed_exit"
  | "no_movement"
  | "multi_room_transition";

/** HA component an entity maps to. Mirrors RuView discovery.rs. */
export type RuViewComponent = "binary_sensor" | "sensor" | "event";

/** A single normalized reading off the wire, post-MQTT. */
export interface SensorReading {
  /** Epoch ms. */
  timestamp: number;
  nodeId: string;
  /** Slug form of {@link RuViewEntityKind}. */
  entity: RuViewEntityKind;
  /** Numeric value for sensors (heart_rate, breathing_rate, ...). */
  value?: number;
  /** Boolean state for binary_sensors. */
  state?: boolean;
  /** Unit string, if any (e.g. "bpm", "dBm"). */
  unit?: string;
  /** Raw payload retained for audit. */
  raw: unknown;
}

// ---------------------------------------------------------------------------
// Domain model
// ---------------------------------------------------------------------------

export interface Resident {
  id: string;
  name: string;
  /** Node(s) that monitor this resident's room. */
  nodeIds: string[];
  room: string;
  /** Per-resident thresholds (override global defaults). */
  thresholds: ResidentThresholds;
  /** Escalation chain (first contacted first). */
  escalationChain: EscalationContact[];
  notificationChannels: NotificationChannels;
  createdAt: number;
  updatedAt: number;
}

export interface ResidentThresholds {
  /** Seconds of stillness after a fast-fall signal before HIGH fires. */
  fallConfirmWindowSec: number;
  /** Daytime inactivity window (sec). Default 7200 (2h). */
  inactivityDaySec: number;
  /** Nighttime inactivity window (sec). Default 28800 (8h). */
  inactivityNightSec: number;
  /** Daytime hours, e.g. ["07:00", "22:00"). */
  dayWindow: [string, string];
  /** Breathing-rate range considered normal for this resident (bpm). */
  breathingRange: [number, number];
  /** Heart-rate range considered normal for this resident (bpm). */
  heartRateRange: [number, number];
  /** Seconds a vitals trend must stay out-of-range before a MEDIUM flag. */
  vitalsAnomalyWindowSec: number;
}

export interface EscalationContact {
  id: string;
  name: string;
  role: string;
  phone?: string; // E.164
  whatsapp?: string; // whatsapp:+...
  /** FCM device token(s) for push. */
  pushTokens: string[];
}

export interface NotificationChannels {
  sms: boolean;
  whatsapp: boolean;
  push: boolean;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export type AlertType =
  | "fall" // HIGH — two-stage confirmed
  | "inactivity" // HIGH — present but not moving
  | "unusual_activity" // MEDIUM — baseline deviation (trend signal)
  | "breathing_trend" // MEDIUM — sustained vitals anomaly (trend flag)
  | "sensor_offline"; // MEDIUM — node silent past heartbeat timeout

export type AlertSeverity = "HIGH" | "MEDIUM";

/**
 * Lifecycle:
 *   pending → active → acknowledged → resolved
 *                      ↘ escalated (after escalationTimeout; still active)
 *
 * HIGH: notifies SMS + WhatsApp + push in parallel.
 * MEDIUM: push + dashboard only (no SMS — anti alert-fatigue).
 */
export type AlertStatus =
  | "pending"
  | "active"
  | "acknowledged"
  | "escalated"
  | "resolved"
  | "false_alarm";

export interface Alert {
  id: string;
  residentId: string;
  residentName: string;
  nodeId: string;
  room: string;
  type: AlertType;
  severity: AlertSeverity;
  status: AlertStatus;
  /** Epoch ms. */
  createdAt: number;
  /** When the caregiver acknowledged it (if they have). */
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  resolvedAt?: number;
  /** Number of escalation rounds fired. */
  escalationCount: number;
  /** Human-facing copy — always hedged ("possible X detected"). */
  message: string;
  /** Trend/vitals context, shown when a caregiver taps in. */
  context?: AlertContext;
  /** Full audit trail of state transitions + notify attempts. */
  audit: AuditEntry[];
}

export interface AlertContext {
  /** Last known vitals at alert time — trend estimate, NOT clinical. */
  breathingRate?: number;
  heartRate?: number;
  /** Seconds since last detected motion. */
  secondsSinceMotion?: number;
  /** Why the rule fired, in plain words. */
  detail: string;
}

export interface AuditEntry {
  timestamp: number;
  /** What happened. */
  action: AuditAction;
  actor: "system" | string; // caregiver id, or "system"
  detail?: string;
}

export type AuditAction =
  | "created"
  | "severity_assigned"
  | "notified_sms"
  | "notified_whatsapp"
  | "notified_push"
  | "notify_failed"
  | "notify_queued"
  | "escalated"
  | "acknowledged"
  | "marked_false_alarm"
  | "resolved"
  | "auto_resolved";

// ---------------------------------------------------------------------------
// Sensor / node health
// ---------------------------------------------------------------------------

export interface NodeHealth {
  nodeId: string;
  /** Epoch ms of last message received from the node. */
  lastSeen: number;
  online: boolean;
  /** Current RSSI, if reported. */
  rssi?: number;
  /** Most-recent vitals snapshot — trend estimate, NOT clinical. */
  breathingRate?: number;
  heartRate?: number;
  presence: boolean;
  /** Epoch ms of last detected motion. */
  lastMotion: number;
}

// ---------------------------------------------------------------------------
// API surface (middleware → dashboard)
// ---------------------------------------------------------------------------

export interface ApiError {
  error: string;
  detail?: string;
}

export interface OverviewSnapshot {
  /** Epoch ms. */
  generatedAt: number;
  residents: Array<{
    id: string;
    name: string;
    room: string;
    status: "normal" | "attention" | "alert";
    /** Active alert id, if status === "alert". */
    activeAlertId?: string;
    activeAlertType?: AlertType;
    /** Per-room sensor health. */
    sensorOnline: boolean;
    sensorLastSeen?: number;
    /** Latest trend estimate (NOT clinical). */
    breathingRate?: number;
    heartRate?: number;
  }>;
}

/** SSE event the dashboard subscribes to at GET /api/events. */
export type SseEvent =
  | { type: "alert"; alert: Alert }
  | { type: "alert_updated"; alert: Alert }
  | { type: "overview"; overview: OverviewSnapshot }
  | { type: "node_health"; node: NodeHealth };
