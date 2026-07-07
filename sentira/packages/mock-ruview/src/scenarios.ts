/**
 * Scenario engine — produces a time-ordered stream of mock readings.
 *
 * Each scenario is a generator that yields the entity + value to publish at
 * each tick. The publisher applies its own interval; scenarios only decide
 * *what* to emit. Scenarios are designed to exercise the middleware's rules:
 *
 *   normal      — steady vitals, presence, occasional motion
 *   fall        — fast-fall event + 20s stillness (two-stage confirm)
 *   inactivity  — presence stays ON but motion stops for > threshold
 *   distress    — breathing drifts out of range, sustained
 *   sensor-offline — node stops publishing entirely (publisher just exits)
 */

import type { EntitySlug } from "./topics.js";

export interface Emission {
  slug: EntitySlug;
  /** Numeric value (sensor) OR undefined for binary/event emissions. */
  value?: number;
  /** For binary_sensor: ON/OFF. For event: trigger. */
  binary?: boolean | "trigger";
}

export type ScenarioName =
  | "normal"
  | "fall"
  | "inactivity"
  | "distress"
  | "sensor-offline";

export interface ScenarioOptions {
  /** Tick index the generator is on (monotonic from 0). */
  tick: number;
  /** Seconds elapsed since the scenario started. */
  elapsedSec: number;
  /** Resident display name, for logs only. */
  residentName: string;
}

export type ScenarioFn = (opts: ScenarioOptions) => Emission[];

/**
 * Normal: presence ON, breathing 16 ± 1, heart 72 ± 2, room_active ON,
 * occasional motion_level spikes. No alerts.
 */
const normal: ScenarioFn = ({ tick }) => {
  const breath = 16 + Math.sin(tick / 8) * 1.1;
  const heart = 72 + Math.sin(tick / 5) * 2.2;
  const motion = tick % 6 === 0 ? 40 + Math.random() * 20 : 5 + Math.random() * 5;
  return [
    { slug: "presence", binary: true },
    { slug: "breathing_rate", value: round(breath) },
    { slug: "heart_rate", value: round(heart) },
    { slug: "motion_level", value: round(motion) },
    { slug: "room_active", binary: motion > 15 },
    { slug: "no_movement", binary: motion < 6 },
    { slug: "fall_risk_elevated", binary: false },
    { slug: "someone_sleeping", binary: false },
    { slug: "rssi", value: -52 - Math.round(Math.random() * 4) },
  ];
};

/**
 * Fall: for the first 2 ticks normal, then a `fall` event fires + motion drops
 * to ~0 + no_movement ON for 20s+ (the two-stage confirm window). After ~25s
 * the scenario loops back toward normal so caregivers can ack & resolve.
 */
const fall: ScenarioFn = ({ elapsedSec }) => {
  const fell = elapsedSec >= 4;
  const recovering = elapsedSec >= 30;
  if (!fell) return normal({ tick: 0, elapsedSec, residentName: "" });

  return [
    { slug: "presence", binary: true },
    { slug: "breathing_rate", value: recovering ? 16 : 12 },
    { slug: "heart_rate", value: recovering ? 74 : 95 },
    { slug: "motion_level", value: recovering ? 8 : 0 },
    { slug: "no_movement", binary: !recovering },
    { slug: "fall_risk_elevated", binary: !recovering },
    // The one-shot event — middleware treats this as the fast-fall spike.
    ...(elapsedSec < 6 ? [{ slug: "fall" as EntitySlug, binary: "trigger" as const }] : []),
    { slug: "rssi", value: -52 },
  ];
};

/**
 * Inactivity: presence stays ON (they're in the room) but motion_level is ~0
 * and no_movement flips ON. The middleware's inactivity rule needs *duration*,
 * so this scenario just holds the state; the alert fires on the rule side.
 */
const inactivity: ScenarioFn = ({ elapsedSec }) => {
  const breath = 14 + Math.sin(elapsedSec / 10) * 0.8;
  return [
    { slug: "presence", binary: true },
    { slug: "breathing_rate", value: round(breath) },
    { slug: "heart_rate", value: 66 },
    { slug: "motion_level", value: 0 },
    { slug: "no_movement", binary: true },
    { slug: "room_active", binary: false },
    { slug: "elderly_inactivity_anomaly", binary: elapsedSec > 10 },
    { slug: "rssi", value: -54 },
  ];
};

/**
 * Distress: breathing climbs to 26+ bpm (out of the default 12–22 range) and
 * stays there — the middleware's breathing-trend rule flags it MEDIUM after
 * the vitalsAnomalyWindow.
 */
const distress: ScenarioFn = ({ elapsedSec }) => {
  const ramped = Math.min(elapsedSec / 12, 1);
  const breath = 16 + ramped * 12; // 16 → 28
  return [
    { slug: "presence", binary: true },
    { slug: "breathing_rate", value: round(breath) },
    { slug: "heart_rate", value: round(80 + ramped * 30) },
    { slug: "motion_level", value: 12 + Math.random() * 8 },
    { slug: "possible_distress", binary: breath > 24 },
    { slug: "rssi", value: -50 },
  ];
};

export const SCENARIOS: Record<ScenarioName, ScenarioFn> = {
  normal,
  fall,
  inactivity,
  distress,
  // sensor-offline is handled by the publisher ceasing to emit.
  "sensor-offline": () => [],
};

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export const SCENARIO_HELP: Record<ScenarioName, string> = {
  normal: "Steady vitals, presence, occasional motion. No alerts expected.",
  fall: "Fast-fall event + 20s+ stillness. Should fire a HIGH (two-stage confirmed) fall alert.",
  inactivity: "Present but not moving. Should fire a HIGH inactivity alert after the configured window.",
  distress: "Breathing drifts out of range, sustained. Should fire a MEDIUM breathing-trend flag.",
  "sensor-offline": "Node stops publishing. Middleware should fire a MEDIUM sensor-offline alert after heartbeat timeout.",
};
