/**
 * Entity metadata — what each RuView entity publishes and how HA classifies it.
 *
 * Mirrors the EntityKind::component() mapping in discovery.rs:
 *   binary_sensor: presence, zone_occupancy, someone_sleeping, possible_distress,
 *                  room_active, elderly_inactivity_anomaly, meeting_in_progress,
 *                  bathroom_occupied, no_movement
 *   event:         fall, bed_exit, multi_room_transition
 *   sensor:        person_count, breathing_rate, heart_rate, motion_level,
 *                  motion_energy, presence_score, rssi, pose
 */

import type { Component, EntitySlug } from "./topics.js";

export interface EntityMeta {
  slug: EntitySlug;
  component: Component;
  /** HA device_class (optional, for nice icons in HA). */
  deviceClass?: string;
  unit?: string;
  /** HA state_class for numeric sensors. */
  stateClass?: "measurement";
  /** Icon (mdi:...). Dashboard uses Phosphor, not these — kept for HA parity. */
  icon?: string;
}

const E = (m: EntityMeta): EntityMeta => m;

export const ENTITIES: readonly EntityMeta[] = [
  E({ slug: "presence", component: "binary_sensor", deviceClass: "occupancy", icon: "mdi:motion-sensor" }),
  E({ slug: "person_count", component: "sensor", stateClass: "measurement", icon: "mdi:account-multiple" }),
  E({ slug: "breathing_rate", component: "sensor", stateClass: "measurement", unit: "bpm", deviceClass: "frequency", icon: "mdi:lung" }),
  E({ slug: "heart_rate", component: "sensor", stateClass: "measurement", unit: "bpm", deviceClass: "frequency", icon: "mdi:heart-pulse" }),
  E({ slug: "motion_level", component: "sensor", stateClass: "measurement", icon: "mdi:walk" }),
  E({ slug: "motion_energy", component: "sensor", stateClass: "measurement", icon: "mdi:run-fast" }),
  E({ slug: "fall", component: "event", icon: "mdi:human" }),
  E({ slug: "presence_score", component: "sensor", stateClass: "measurement", icon: "mdi:percent" }),
  E({ slug: "rssi", component: "sensor", stateClass: "measurement", unit: "dBm", deviceClass: "signal_strength", icon: "mdi:wifi" }),
  E({ slug: "zone_occupancy", component: "binary_sensor", deviceClass: "occupancy", icon: "mdi:home" }),
  E({ slug: "pose", component: "sensor", icon: "mdi:human-handsdown" }),
  E({ slug: "someone_sleeping", component: "binary_sensor", icon: "mdi:bed" }),
  E({ slug: "possible_distress", component: "binary_sensor", icon: "mdi:alert" }),
  E({ slug: "room_active", component: "binary_sensor", deviceClass: "moving", icon: "mdi:motion" }),
  E({ slug: "elderly_inactivity_anomaly", component: "binary_sensor", icon: "mdi:account-clock" }),
  E({ slug: "meeting_in_progress", component: "binary_sensor", icon: "mdi:account-group" }),
  E({ slug: "bathroom_occupied", component: "binary_sensor", icon: "mdi:toilet" }),
  E({ slug: "fall_risk_elevated", component: "sensor", stateClass: "measurement", icon: "mdi:human-fall" }),
  E({ slug: "bed_exit", component: "event", icon: "mdi:bed-empty" }),
  E({ slug: "no_movement", component: "binary_sensor", icon: "mdi:motion-off" }),
  E({ slug: "multi_room_transition", component: "event", icon: "mdi:swap-horizontal" }),
] as const;

export function entitiesFor(component: Component): readonly EntityMeta[] {
  return ENTITIES.filter((e) => e.component === component);
}
