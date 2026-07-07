/**
 * MQTT topic builders that mirror RuView's contract 1:1.
 *
 * Source of truth: ruview/v2/crates/wifi-densepose-sensing-server/src/mqtt/discovery.rs
 *
 * Topic shape:
 *   <prefix>/<component>/<node_id>/<slug>/<kind>
 * where <kind> ∈ {config, state, availability}.
 *
 * Matching this exactly means the middleware cannot tell the mock apart
 * from a real RuView sensing-server — swapping the publisher is a broker
 * config change, not a code change.
 */

export type Component = "binary_sensor" | "sensor" | "event";

export type EntitySlug =
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

export interface TopicParts {
  prefix: string;
  component: Component;
  nodeId: string;
  slug: EntitySlug;
}

export function baseTopic(p: TopicParts): string {
  return `${p.prefix}/${p.component}/${p.nodeId}/${p.slug}`;
}

export function configTopic(p: TopicParts): string {
  return `${baseTopic(p)}/config`;
}

export function stateTopic(p: TopicParts): string {
  return `${baseTopic(p)}/state`;
}

export function availabilityTopic(p: TopicParts): string {
  return `${baseTopic(p)}/availability`;
}
