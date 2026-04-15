import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

// Field paths to redact from all log output.
// Pino replaces matching values with "[Redacted]" before serialisation.
// This is a safety net — no code path intentionally logs these fields,
// but redaction prevents accidental leakage if a raw header/config object
// is ever passed to a log call.
const REDACT_PATHS = [
  "authorization",
  "Authorization",
  "*.authorization",
  "*.Authorization",
  "apikey",
  "apiKey",
  "api_key",
  "*.apikey",
  "*.apiKey",
  "*.api_key",
  "password",
  "*.password",
  "basicAuth.password",
  "*.basicAuth.password",
  // Cover request_headers objects (e.g. ProbeRecord.request_headers)
  "request_headers.authorization",
  "request_headers.Authorization",
  "cold_http.request_headers.authorization",
  "cold_http.request_headers.Authorization",
  "warmed_http.request_headers.authorization",
  "warmed_http.request_headers.Authorization",
];

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: { paths: REDACT_PATHS, censor: "[Redacted]" },
  transport: isDev
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
  base: { service: "site-scanner" },
});

export function childLogger(component: string, extra?: Record<string, unknown>) {
  return logger.child({ component, ...extra });
}
