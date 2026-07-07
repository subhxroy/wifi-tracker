/**
 * HTTP + Server-Sent-Events server — the dashboard's API surface.
 *
 * REST:
 *   GET    /health                                   liveness
 *   GET    /api/overview                             the calm overview snapshot
 *   GET    /api/residents                            resident list
 *   GET    /api/residents/:id                        resident detail
 *   PATCH  /api/residents/:id                        update thresholds / channels
 *   GET    /api/alerts                               ?residentId=&includeResolved=&limit=
 *   GET    /api/alerts/:id                           alert detail w/ audit
 *   POST   /api/alerts/:id/acknowledge               caregiver ack
 *   POST   /api/alerts/:id/escalate                  manual "escalate now"
 *   POST   /api/alerts/:id/false-alarm               caregiver false-alarm
 *   POST   /api/alerts/:id/resolve                   resolve
 *   GET    /api/nodes                                sensor-health view
 *
 * SSE:
 *   GET    /api/events                               real-time alert + node + overview updates
 *
 * Auth: if MIDDLEWARE_API_TOKEN is set, requests must carry
 *       `Authorization: Bearer <token>`. Empty → unauthenticated local dev.
 */

import Fastify, { type FastifyInstance } from "fastify";
import type { ServerResponse } from "node:http";
import cors from "@fastify/cors";
import type { SseEvent } from "@sentira/types";
import type { MiddlewareConfig } from "./config.js";
import { logger } from "./logger.js";
import type { Store } from "./store.js";
import type { AlertManager } from "./alert-manager.js";

export function buildServer(
  store: Store,
  alerts: AlertManager,
  cfg: MiddlewareConfig,
): FastifyInstance {
  const app = Fastify({ logger: false });
  const sseClients = new Set<((e: SseEvent) => void)>();

  // Subscribe to store events → fan out to SSE clients.
  store.subscribe((ev) => {
    const sse: SseEvent | undefined =
      ev.kind === "alert_created" ? { type: "alert", alert: ev.alert }
      : ev.kind === "alert_updated" ? { type: "alert_updated", alert: ev.alert }
      : ev.kind === "node_health" ? { type: "node_health", node: ev.node }
      : ev.kind === "overview" ? { type: "overview", overview: ev.snapshot }
      : undefined;
    if (sse) for (const send of sseClients) send(sse);
  });

  void app.register(cors, { origin: cfg.http.corsOrigin });

  // --- auth hook ---
  app.addHook("onRequest", async (req, reply) => {
    if (!cfg.http.apiToken) return; // stub mode
    if (req.routeOptions.url === "/health") return;
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${cfg.http.apiToken}`) {
      reply.code(401).send({ error: "unauthorized" });
    }
  });

  // --- liveness ---
  app.get("/health", async () => ({ status: "ok", service: "sentira-middleware", now: Date.now() }));

  // --- overview ---
  app.get("/api/overview", async () => store.overview());

  // --- residents ---
  app.get("/api/residents", async () => store.getResidents());

  app.get("/api/residents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const resident = store.getResident(id);
    if (!resident) return reply.code(404).send({ error: "resident not found" });
    const alertsForResident = store.listAlerts({ residentId: id, includeResolved: true, limit: 50 });
    const nodes = resident.nodeIds.map((nid) => store.getNode(nid)).filter(Boolean);
    return { resident, nodes, recentAlerts: alertsForResident };
  });

  app.patch("/api/residents/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const resident = store.getResident(id);
    if (!resident) return reply.code(404).send({ error: "resident not found" });
    const body = req.body as Partial<typeof resident>;
    const next = {
      ...resident,
      ...("thresholds" in body ? { thresholds: { ...resident.thresholds, ...(body.thresholds ?? {}) } } : {}),
      ...("notificationChannels" in body ? { notificationChannels: { ...resident.notificationChannels, ...(body.notificationChannels ?? {}) } } : {}),
      ...("escalationChain" in body && body.escalationChain ? { escalationChain: body.escalationChain } : {}),
      updatedAt: Date.now(),
    };
    store.upsertResident(next);
    return next;
  });

  // --- alerts ---
  app.get("/api/alerts", async (req) => {
    const q = req.query as { residentId?: string; includeResolved?: string; limit?: string };
    return store.listAlerts({
      residentId: q.residentId,
      includeResolved: q.includeResolved === "true",
      limit: q.limit ? Number(q.limit) : undefined,
    });
  });

  app.get("/api/alerts/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const alert = store.getAlert(id);
    if (!alert) return reply.code(404).send({ error: "alert not found" });
    return alert;
  });

  app.post("/api/alerts/:id/acknowledge", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { caregiverId?: string };
    const alert = alerts.acknowledge(id, body.caregiverId ?? "dashboard_user");
    if (!alert) return reply.code(404).send({ error: "alert not found" });
    return alert;
  });

  app.post("/api/alerts/:id/escalate", async (req, reply) => {
    const { id } = req.params as { id: string };
    const alert = store.getAlert(id);
    if (!alert) return reply.code(404).send({ error: "alert not found" });
    await alerts.escalate(id);
    return store.getAlert(id);
  });

  app.post("/api/alerts/:id/false-alarm", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { caregiverId?: string };
    const alert = alerts.markFalseAlarm(id, body.caregiverId ?? "dashboard_user");
    if (!alert) return reply.code(404).send({ error: "alert not found" });
    return alert;
  });

  app.post("/api/alerts/:id/resolve", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { caregiverId?: string };
    const alert = alerts.resolve(id, body.caregiverId ?? "dashboard_user");
    if (!alert) return reply.code(404).send({ error: "alert not found" });
    return alert;
  });

  // --- nodes ---
  app.get("/api/nodes", async () => store.allNodes());

  // --- SSE ---
  app.get("/api/events", async (req, reply) => {
    // For SSE we drive the underlying Node ServerResponse directly.
    const raw = reply.raw as unknown as ServerResponse;
    raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    raw.write(": hello\n\n");
    const send = (e: SseEvent) => {
      raw.write(`data: ${JSON.stringify(e)}\n\n`);
    };
    sseClients.add(send);
    // Send a fresh overview immediately so the dashboard hydrates on connect.
    send({ type: "overview", overview: store.overview() });
    req.raw.on("close", () => {
      sseClients.delete(send);
    });
    // Halt Fastify's default response handling — we've already replied.
    return reply.hijack();
  });

  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    logger.error({ err }, "request error");
    reply.code(err.statusCode ?? 500).send({ error: err.message });
  });

  return app;
}
