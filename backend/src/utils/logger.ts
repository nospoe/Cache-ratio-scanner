import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
  base: { service: "site-scanner" },
});

export function childLogger(component: string, extra?: Record<string, unknown>) {
  return logger.child({ component, ...extra });
}
