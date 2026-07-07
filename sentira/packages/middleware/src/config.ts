/**
 * Resolved runtime configuration — every env var has a safe default so the
 * middleware boots in stub mode with zero configuration.
 */

import { env } from "node:process";

function num(key: string, def: number): number {
  const v = env[key];
  if (v === undefined || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function str(key: string, def: string): string {
  const v = env[key];
  return v === undefined || v === "" ? def : v;
}

export interface MiddlewareConfig {
  mqtt: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    discoveryPrefix: string;
    nodePrefix: string;
  };
  http: { port: number; apiToken?: string; corsOrigin: string };
  thresholds: {
    fallConfirmWindowSec: number;
    inactivityDaySec: number;
    inactivityNightSec: number;
    heartbeatTimeoutSec: number;
    escalationTimeoutSec: number;
    vitalsAnomalyWindowSec: number;
    dayWindow: [string, string];
  };
  providers: {
    twilio: { accountSid?: string; authToken?: string; fromNumber?: string; whatsappFrom?: string };
    fcm: { serviceAccountPath?: string };
  };
  logLevel: string;
}

export function loadConfig(): MiddlewareConfig {
  return {
    mqtt: {
      host: str("MQTT_HOST", "127.0.0.1"),
      port: num("MQTT_PORT", 1883),
      username: env.MQTT_USERNAME || undefined,
      password: env.MQTT_PASSWORD || undefined,
      discoveryPrefix: str("MQTT_DISCOVERY_PREFIX", "homeassistant"),
      nodePrefix: str("RUVIEW_NODE_PREFIX", "wifi_densepose"),
    },
    http: {
      port: num("MIDDLEWARE_PORT", 4400),
      apiToken: env.MIDDLEWARE_API_TOKEN || undefined,
      corsOrigin: str("CORS_ORIGIN", "*"),
    },
    thresholds: {
      fallConfirmWindowSec: num("FALL_CONFIRM_WINDOW_SECONDS", 20),
      inactivityDaySec: num("INACTIVITY_DAY_SECONDS", 7200),
      inactivityNightSec: num("INACTIVITY_NIGHT_SECONDS", 28800),
      heartbeatTimeoutSec: num("HEARTBEAT_TIMEOUT_SECONDS", 90),
      escalationTimeoutSec: num("ESCALATION_TIMEOUT_SECONDS", 180),
      vitalsAnomalyWindowSec: num("VITALS_ANOMALY_WINDOW_SECONDS", 300),
      dayWindow: ["07:00", "22:00"],
    },
    providers: {
      twilio: {
        accountSid: env.TWILIO_ACCOUNT_SID || undefined,
        authToken: env.TWILIO_AUTH_TOKEN || undefined,
        fromNumber: env.TWILIO_FROM_NUMBER || undefined,
        whatsappFrom: env.TWILIO_WHATSAPP_FROM || undefined,
      },
      fcm: { serviceAccountPath: env.FCM_SERVICE_ACCOUNT_PATH || undefined },
    },
    logLevel: str("LOG_LEVEL", "info"),
  };
}

/** True when a provider has its real credentials configured. */
export function twilioConfigured(c: MiddlewareConfig): boolean {
  return Boolean(c.providers.twilio.accountSid && c.providers.twilio.authToken && c.providers.twilio.fromNumber);
}

export function fcmConfigured(c: MiddlewareConfig): boolean {
  return Boolean(c.providers.fcm.serviceAccountPath);
}
