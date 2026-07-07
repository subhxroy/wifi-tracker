/** Structured logging via pino. One logger per process. */

import pino from "pino";
import { env } from "node:process";

export const logger = pino({
  level: env.LOG_LEVEL ?? "info",
  base: { service: "sentira-middleware" },
  transport:
    process.stdout.isTTY && env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname,service" } }
      : undefined,
});
