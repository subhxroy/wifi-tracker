/**
 * End-to-end integration test.
 * Tests the full pipeline: mock-ruview → MQTT → middleware → store → API
 * Runs in a single Node.js process using the in-memory Aedes broker.
 */

import { createServer } from "node:net";
import { Aedes } from "aedes";
import { loadConfig } from "./config.js";
import { logger } from "./logger.js";
import { Store } from "./store.js";
import { seedResidents } from "./seed.js";
import { MqttIngestor } from "./mqtt.js";
import { Engine } from "./engine.js";
import { AlertManager } from "./alert-manager.js";
import { buildServer } from "./server.js";
import { RuViewPublisher } from "../../mock-ruview/src/publisher.js";
import { ENTITIES } from "../../mock-ruview/src/entities.js";
import { buildDiscoveryConfig, componentForSlug } from "../../mock-ruview/src/discovery.js";
import { SCENARIOS } from "../../mock-ruview/src/scenarios.js";
import type { SensorReading } from "@sentira/types";

async function main(): Promise<void> {
  console.log("=== E2E Integration Test ===");

  // 1. Start in-process MQTT broker
  const aedes = await Aedes.createBroker();
  const server = createServer(aedes.handle);
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => resolve());
    server.on("error", reject);
  });
  const port = (server.address() as any).port;
  console.log(`MQTT broker on 127.0.0.1:${port}`);

  // 2. Create middleware with test config pointing at our broker
  const cfg = loadConfig();
  cfg.mqtt.port = port;
  cfg.mqtt.host = "127.0.0.1";
  cfg.mqtt.discoveryPrefix = "homeassistant";
  cfg.mqtt.nodePrefix = "wifi_densepose";

  const store = new Store(seedResidents());
  const alerts = new AlertManager(store, cfg);
  const ingestor = new MqttIngestor(cfg, store);
  const engine = new Engine(store, cfg, alerts, ingestor);
  ingestor.onReading = engine.onReading;

  await engine.start();
  const app = buildServer(store, alerts, cfg);
  await app.listen({ host: "127.0.0.1", port: 0 });
  const httpPort = (app.server.address() as any).port;
  console.log(`HTTP server on 127.0.0.1:${httpPort}`);

  // 3. Connect mock-ruview publisher — nodeId must match seed data
  const publisher = new RuViewPublisher({
    host: "127.0.0.1",
    port,
    prefix: "homeassistant",
    nodeId: "wifi_densepose_a",
    friendlyName: "Room A (mock)",
    swVersion: "0.1.0-test",
  });
  await publisher.connect();
  console.log("Mock publisher connected");

  // 4. Publish discovery
  await publisher.publishDiscovery(ENTITIES, ({ slug, component }) =>
    buildDiscoveryConfig({
      prefix: "homeassistant",
      nodeId: publisher.nodeId,
      nodeFriendlyName: publisher.nodeId,
      swVersion: "0.1.0-test",
      meta: ENTITIES.find((e) => e.slug === slug && e.component === component)!,
    }),
  );
  console.log("Discovery published");

  // 5. Run fall scenario for a few ticks
  const scenario = SCENARIOS["fall"];

  // Also track readings in the store to verify decodeReading works
  let fallReadingCount = 0;

  for (let tick = 0; tick < 6; tick++) {
    const elapsedSec = tick * 2; // 2s per tick
    const ts = Date.now();
    const emissions = scenario({ tick, elapsedSec, residentName: "Alice" }).map((e) => ({
      ...e,
      component: componentForSlug(e.slug),
    }));
    await publisher.publishState(emissions, ts);
    const fallEmissions = emissions.filter((e) => e.slug === "fall");
    if (fallEmissions.length > 0) fallReadingCount++;
    console.log(`Tick ${tick} (elapsed=${elapsedSec}s): ${emissions.length} emissions (${fallEmissions.length} fall events)`);
    await new Promise((r) => setTimeout(r, 200));
  }

  // Wait for processing
  await new Promise((r) => setTimeout(r, 1000));

  // 6. Verify via HTTP API
  const httpBase = `http://127.0.0.1:${httpPort}`;

  // Health check
  const health = await fetch(`${httpBase}/health`).then((r) => r.json());
  console.log(`\nHealth: ${JSON.stringify(health)}`);
  console.assert(health.status === "ok", "Health check should pass");

  // Overview — should show the resident with sensorOnline=true
  const overview = await fetch(`${httpBase}/api/overview`).then((r) => r.json());
  console.log(`Overview residents: ${overview.residents.length}`);
  for (const r of overview.residents) {
    console.log(`  ${r.name} (${r.room}): status=${r.status}, sensorOnline=${r.sensorOnline}, heartRate=${r.heartRate}, breathingRate=${r.breathingRate}`);
  }
  console.assert(overview.residents.length > 0, "Should have residents");
  const alice = overview.residents.find((r: any) => r.id === "res_alice");
  console.assert(alice?.sensorOnline === true, "Alice's sensor should be online after mock data");

  // Verify node health shows data from mock
  const nodes = await fetch(`${httpBase}/api/nodes`).then((r) => r.json());
  console.log(`\nNodes: ${nodes.length}`);
  for (const n of nodes) {
    console.log(`  ${n.nodeId}: online=${n.online}, breath=${n.breathingRate}, HR=${n.heartRate}, presence=${n.presence}`);
  }

  // Alerts before fall confirm window
  const alerts_before = await fetch(`${httpBase}/api/alerts?limit=10`).then((r) => r.json());
  console.log(`\nAlerts before fall window: ${alerts_before.length}`);
  for (const a of alerts_before) {
    console.log(`  [${a.severity}] ${a.type}: ${a.message} (status=${a.status})`);
  }

  // Fall should be pending in the store
  const pendingCount = store.pendingFalls.size;
  console.log(`\nPending falls in store: ${pendingCount}`);
  console.assert(pendingCount > 0, "Should have a pending fall after fall event");

  // Wait for fall confirmation (fallConfirmWindowSec=20s by default)
  console.log(`\nWaiting ${cfg.thresholds.fallConfirmWindowSec}s for fall confirm window...`);
  await new Promise((r) => setTimeout(r, cfg.thresholds.fallConfirmWindowSec * 1000 + 2000));

  // Check alerts again — should now have the fall alert
  const alerts_after = await fetch(`${httpBase}/api/alerts?limit=10`).then((r) => r.json());
  console.log(`\nAlerts after confirm window: ${alerts_after.length}`);
  const fallAlerts = alerts_after.filter((a: any) => a.type === "fall");
  console.log(`  Fall alerts via API: ${fallAlerts.length}`);
  for (const a of fallAlerts) {
    console.log(`  ✓ [${a.severity}] ${a.type}: ${a.message}`);
    console.log(`    status=${a.status}, context: ${JSON.stringify(a.context)}`);
  }

  // 7. Clean shutdown
  await publisher.disconnect();
  await ingestor.stop();
  await app.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));

  // 8. Summary
  const fallPass = fallAlerts.length > 0;
  const healthPass = health.status === "ok";
  const seedPass = overview.residents.length > 0;
  const sensorPass = alice?.sensorOnline === true;
  const pendingPass = pendingCount > 0;
  const allPass = fallPass && healthPass && seedPass && sensorPass && pendingPass;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`E2E TEST RESULTS:`);
  console.log(`  ✓ Health check:            ${healthPass ? "PASS" : "FAIL"}`);
  console.log(`  ✓ Seed residents loaded:   ${seedPass ? "PASS" : "FAIL"}`);
  console.log(`  ✓ Sensor online detected:  ${sensorPass ? "PASS" : "FAIL"}`);
  console.log(`  ✓ Pending fall recorded:   ${pendingPass ? "PASS" : "FAIL"}`);
  console.log(`  ✓ Fall alert after window: ${fallPass ? "PASS" : "FAIL"}`);
  console.log(`${"=".repeat(60)}`);

  if (!allPass) {
    console.error("\n❌ Some tests failed — see details above");
    process.exit(1);
  }
  console.log("\n✅ ALL E2E TESTS PASSED — system ready for hardware");
}

main().catch((err) => {
  console.error("E2E test failed:", err);
  process.exit(1);
});
