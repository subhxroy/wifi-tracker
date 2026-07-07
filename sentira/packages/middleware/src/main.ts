/**
 * Sentira middleware entrypoint.
 *
 * Boots the in-memory store (seeded), MQTT ingestor, rules engine, alert
 * manager, heartbeat monitor, and HTTP/SSE server. Runs entirely locally
 * with zero configuration — every provider falls back to stub mode when
 * its credentials are absent.
 */

import { loadConfig, twilioConfigured, fcmConfigured } from "./config.js";
import { logger } from "./logger.js";
import { Store } from "./store.js";
import { seedResidents } from "./seed.js";
import { MqttIngestor } from "./mqtt.js";
import { Engine } from "./engine.js";
import { AlertManager } from "./alert-manager.js";
import { HeartbeatMonitor } from "./heartbeat.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  logger.info(cfg, "configuration loaded");
  logger.info({ twilio: twilioConfigured(cfg), fcm: fcmConfigured(cfg) }, "provider status (stub mode when false)");

  const store = new Store(seedResidents());
  const alerts = new AlertManager(store, cfg);
  const ingestor = new MqttIngestor(cfg, store);
  const engine = new Engine(store, cfg, alerts, ingestor);
  // Wire the ingestor's per-reading callback to the engine now that both exist.
  ingestor.onReading = engine.onReading;

  await engine.start();

  const heartbeat = new HeartbeatMonitor(store, cfg, alerts);
  heartbeat.start();

  const app = buildServer(store, alerts, cfg);
  await app.listen({ host: "0.0.0.0", port: cfg.http.port });
  logger.info({ url: `http://127.0.0.1:${cfg.http.port}` }, "middleware HTTP/SSE server listening");

  const shutdown = async (sig: string) => {
    logger.info({ sig }, "shutting down");
    heartbeat.stop();
    await ingestor.stop();
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error("[middleware] fatal:", err);
  process.exit(1);
});
