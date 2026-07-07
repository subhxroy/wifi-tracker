/**
 * Builds the HA discovery `config` payload for each entity — mirrors RuView's
 * DiscoveryConfig struct (see discovery.rs). Published retained on the
 * <...>/config topic so HA (and our middleware) can auto-discover.
 */

import type { EntityMeta } from "./entities.js";
import type { Component, EntitySlug } from "./topics.js";

const MANUFACTURER = "ruvnet";
const MODEL = "ESP32-S3 CSI node (mock)";
const ORIGIN_NAME = "sentira-mock-ruview";
const SUPPORT_URL = "https://github.com/ruvnet/ruview";

export interface DeviceMeta {
  identifiers: string[];
  name: string;
  manufacturer: string;
  model: string;
  sw_version: string;
  via_device?: string;
}

export interface DiscoveryConfig {
  name: string;
  unique_id: string;
  object_id: string;
  state_topic: string;
  availability_topic: string;
  payload_available: "online";
  payload_not_available: "offline";
  payload_on?: "ON";
  payload_off?: "OFF";
  device_class?: string;
  state_class?: "measurement";
  unit_of_measurement?: string;
  icon?: string;
  value_template?: string;
  json_attributes_topic?: string;
  event_types?: string[];
  qos: 1;
  device: DeviceMeta;
  origin: { name: string; sw_version: string; support_url: string };
}

export function buildDiscoveryConfig(args: {
  prefix: string;
  nodeId: string;
  nodeFriendlyName: string;
  swVersion: string;
  meta: EntityMeta;
}): DiscoveryConfig {
  const { prefix, nodeId, nodeFriendlyName, swVersion, meta } = args;
  const base = `${prefix}/${meta.component}/${nodeId}/${meta.slug}`;
  const uniqueId = `${nodeId}_${meta.slug}`;
  const isBinary = meta.component === "binary_sensor";
  const isEvent = meta.component === "event";

  return {
    name: prettify(meta.slug),
    unique_id: uniqueId,
    object_id: uniqueId,
    state_topic: `${base}/state`,
    availability_topic: `${base}/availability`,
    payload_available: "online",
    payload_not_available: "offline",
    ...(isBinary ? { payload_on: "ON", payload_off: "OFF" } : {}),
    ...(meta.deviceClass ? { device_class: meta.deviceClass } : {}),
    ...(meta.stateClass ? { state_class: meta.stateClass } : {}),
    ...(meta.unit ? { unit_of_measurement: meta.unit } : {}),
    ...(meta.icon ? { icon: meta.icon } : {}),
    ...(isEvent ? { event_types: ["trigger"] } : {}),
    qos: 1,
    device: {
      identifiers: [nodeId],
      name: nodeFriendlyName,
      manufacturer: MANUFACTURER,
      model: MODEL,
      sw_version: swVersion,
    },
    origin: { name: ORIGIN_NAME, sw_version: swVersion, support_url: SUPPORT_URL },
  };
}

function prettify(slug: EntitySlug | string): string {
  return String(slug)
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Component the middleware uses to find a state topic — kept here for parity. */
export function componentForSlug(slug: EntitySlug): Component {
  // Mirror ENTITIES table.
  const binary: EntitySlug[] = [
    "presence", "zone_occupancy", "someone_sleeping", "possible_distress",
    "room_active", "elderly_inactivity_anomaly", "meeting_in_progress",
    "bathroom_occupied", "no_movement",
  ];
  const event: EntitySlug[] = ["fall", "bed_exit", "multi_room_transition"];
  if (binary.includes(slug)) return "binary_sensor";
  if (event.includes(slug)) return "event";
  return "sensor";
}
