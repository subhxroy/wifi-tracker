#!/usr/bin/env node
/**
 * mock-ruview CLI — the hardware stand-in.
 *
 * Publishes RuView-shaped MQTT messages for one or more demo nodes, driven
 * by a scenario. Designed to run on the bench with no ESP32 hardware.
 *
 *   pnpm --filter @sentira/mock-ruview start                       # normal
 *   pnpm --filter @sentira/mock-ruview start -- --scenario fall
 *   pnpm --filter @sentira/mock-ruview start -- --nodes 3 --interval 2000
 *   pnpm --filter @sentira/mock-ruview start -- --scenario sensor-offline --after 10
 *
 * Reads MQTT_HOST / MQTT_PORT / MQTT_DISCOVERY_PREFIX / RUVIEW_NODE_PREFIX from env.
 */

import { env } from "node:process";
import { createServer } from "node:net";
import { Aedes } from "aedes";
import { RuViewPublisher } from "./publisher.js";
import { ENTITIES } from "./entities.js";
import { buildDiscoveryConfig } from "./discovery.js";
import { SCENARIOS, SCENARIO_HELP, type ScenarioName } from "./scenarios.js";
import { componentForSlug } from "./discovery.js";

interface Args {
  scenario: ScenarioName;
  nodes: number;
  intervalMs: number;
  afterSec: number;
  once: boolean;
  listScenarios: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    scenario: "normal",
    nodes: 2,
    intervalMs: 2000,
    afterSec: 0,
    once: false,
    listScenarios: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--scenario": case "-s": a.scenario = (argv[++i] ?? "normal") as ScenarioName; break;
      case "--nodes": case "-n": a.nodes = Number.parseInt(argv[++i] ?? "2", 10); break;
      case "--interval": a.intervalMs = Number.parseInt(argv[++i] ?? "2000", 10); break;
      case "--after": a.afterSec = Number.parseInt(argv[++i] ?? "0", 10); break;
      case "--once": a.once = true; break;
      case "--list": case "-l": a.listScenarios = true; break;
      case "--help": case "-h": printHelp(); process.exit(0);
      default:
        if (arg?.startsWith("--scenario=")) a.scenario = arg.split("=")[1] as ScenarioName;
        else if (arg && !arg.startsWith("-")) a.scenario = arg as ScenarioName;
        break;
    }
  }
  if (!SCENARIOS[a.scenario]) {
    console.error(`Unknown scenario: ${a.scenario}\n--list to see options.`);
    process.exit(2);
  }
  return a;
}

function printHelp(): void {
  console.log(`mock-ruview — RuView-shaped MQTT publisher (hardware stand-in)

USAGE
  mock-ruview [--scenario <name>] [--nodes N] [--interval ms] [--once] [--after sec]

OPTIONS
  -s, --scenario <name>   Scenario to run (default: normal). See --list.
  -n, --nodes <N>          Number of demo nodes to simulate (default: 2).
      --interval <ms>      Publish interval per node (default: 2000).
      --after <sec>        Seconds before the scenario starts (default: 0).
      --once               Publish one tick then exit (useful for tests).
  -l, --list               List scenarios and exit.
  -h, --help               Show this help.

ENV
  MQTT_HOST, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD,
  MQTT_DISCOVERY_PREFIX (default homeassistant), RUVIEW_NODE_PREFIX (default wifi_densepose)
`);
}

function listScenarios(): void {
  console.log("Scenarios:");
  for (const [name, help] of Object.entries(SCENARIO_HELP)) {
    console.log(`  ${name.padEnd(16)} ${help}`);
  }
}

async function startLocalBroker(host: string, port: number): Promise<void> {
  if (host !== "127.0.0.1" && host !== "localhost") {
    return;
  }
  return new Promise<void>(async (resolve) => {
    try {
      const aedes = await Aedes.createBroker();
      const server = createServer(aedes.handle);
      server.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          log(`port ${port} already in use. Assuming external MQTT broker is running.`);
          resolve();
        } else {
          console.error("[mock-ruview] Local MQTT broker error:", err);
          resolve();
        }
      });
      server.listen(port, "127.0.0.1", () => {
        log(`started local in-memory MQTT broker on 127.0.0.1:${port}`);
        resolve();
      });
    } catch (e) {
      console.error("[mock-ruview] Failed to start local broker:", e);
      resolve();
    }
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.listScenarios) { listScenarios(); return; }

  const host = env.MQTT_HOST ?? "127.0.0.1";
  const port = Number(env.MQTT_PORT ?? "1883");
  const prefix = env.MQTT_DISCOVERY_PREFIX ?? "homeassistant";
  const nodePrefix = env.RUVIEW_NODE_PREFIX ?? "wifi_densepose";
  const swVersion = "0.1.0-mock";

  await startLocalBroker(host, port);

  log(`connecting to mqtt://${host}:${port} (${prefix}/...)`);
  const nodes = Array.from({ length: args.nodes }, (_, i) => {
    const publisher = new RuViewPublisher({
      host, port,
      username: env.MQTT_USERNAME || undefined,
      password: env.MQTT_PASSWORD || undefined,
      prefix,
      nodeId: `${nodePrefix}_${roomLabel(i)}`,
      friendlyName: `Room ${roomLabel(i).toUpperCase()} (mock)`,
      swVersion,
    });
    return publisher;
  });

  await Promise.all(nodes.map((n) => n.connect()));
  log(`connected ${nodes.length} node(s): ${nodes.map((n) => n.nodeId).join(", ")}`);

  // Publish HA discovery once per node.
  for (const n of nodes) {
    await n.publishDiscovery(ENTITIES, ({ slug, component }) =>
      buildDiscoveryConfig({
        prefix, nodeId: n.nodeId,
        nodeFriendlyName: n.nodeId,
        swVersion,
        meta: ENTITIES.find((e) => e.slug === slug && e.component === component)!,
      }),
    );
  }
  log(`discovery published for ${ENTITIES.length} entities/node`);

  if (args.scenario === "sensor-offline") {
    log("scenario=sensor-offline: discovery published, now going silent (simulating node loss).");
    log(`middleware should fire sensor-offline after HEARTBEAT_TIMEOUT (${env.HEARTBEAT_TIMEOUT_SECONDS ?? 90}s).`);
    if (!args.once) {
      await sleep(2000);
      for (const n of nodes) await n.goOffline();
      log("nodes marked offline; mock exiting. Restart to reannounce.");
    }
    return;
  }

  const scenario = SCENARIOS[args.scenario];
  const startedAt = Date.now();
  if (args.afterSec > 0) {
    log(`waiting ${args.afterSec}s before starting scenario...`);
    await sleep(args.afterSec * 1000);
  }

  log(`running scenario=${args.scenario}, interval=${args.intervalMs}ms. Ctrl-C to stop.`);
  let tick = 0;
  const interval = setInterval(async () => {
    const elapsedSec = (Date.now() - startedAt) / 1000;
    const ts = startedAt + tick * args.intervalMs;
    for (const [i, n] of nodes.entries()) {
      const emissions = scenario({ tick, elapsedSec, residentName: n.nodeId }).map((e) => ({
        ...e,
        component: ENTITIES.find((m) => m.slug === e.slug)?.component ?? componentForSlug(e.slug),
      }));
      await n.publishState(emissions, ts);
    }
    tick++;
    if (args.once) { clearInterval(interval); await Promise.all(nodes.map((n) => n.disconnect())); }
  }, args.intervalMs);

  const shutdown = async () => {
    clearInterval(interval);
    log("shutting down...");
    await Promise.all(nodes.map((n) => n.disconnect()));
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function roomLabel(i: number): string {
  return ["a", "b", "c", "d", "e", "f", "g", "h"][i] ?? `n${i}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function log(msg: string): void {
  // ISO timestamp + clear prefix — middleware logs in the same shape.
  console.log(`[mock-ruview ${new Date().toISOString()}] ${msg}`);
}

main().catch((err) => {
  console.error("[mock-ruview] fatal:", err);
  process.exit(1);
});
