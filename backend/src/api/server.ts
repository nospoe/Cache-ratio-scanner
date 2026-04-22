import express from "express";
import cors from "cors";
import helmet from "helmet";
import { runMigrations } from "../db/migrate";
import scansRouter from "./routes/scans";
import pagesRouter from "./routes/pages";
import exportsRouter from "./routes/exports";
import globalRankingsRouter from "./routes/globalRankings";
import aiRouter from "./routes/ai";
import { childLogger } from "../utils/logger";

const log = childLogger("api.server");
const app = express();

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  methods: ["GET", "POST", "DELETE"],
}));
app.use(express.json({ limit: "1mb" }));

// Request logging
app.use((req, _res, next) => {
  log.debug({ method: req.method, path: req.path }, "Request");
  next();
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/scans", scansRouter);
app.use("/api/scans/:id/pages", pagesRouter);
app.use("/api/scans/:id", exportsRouter);
app.use("/api/pages", globalRankingsRouter);
app.use("/api/ai", aiRouter);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log.error({ err: err.message }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

async function main() {
  log.info("Running migrations...");
  await runMigrations();

  const port = parseInt(process.env.PORT || "3001");
  app.listen(port, "0.0.0.0", () => {
    log.info({ port }, "API server started");
  });
}

main().catch((err) => {
  log.error({ err }, "Server startup failed");
  process.exit(1);
});

export default app;
