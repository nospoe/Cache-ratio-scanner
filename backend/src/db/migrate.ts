import fs from "fs";
import path from "path";
import { getPool } from "./client";
import { logger } from "../utils/logger";

export async function runMigrations(): Promise<void> {
  const pool = getPool();

  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const migrationsDir = path.join(__dirname, "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = await pool.query<{ filename: string }>(
    "SELECT filename FROM schema_migrations"
  );
  const appliedSet = new Set(applied.rows.map((r) => r.filename));

  for (const file of files) {
    if (appliedSet.has(file)) {
      logger.debug({ file }, "Migration already applied, skipping");
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    logger.info({ file }, "Applying migration");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [file]
      );
      await client.query("COMMIT");
      logger.info({ file }, "Migration applied successfully");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

// Run directly
if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info("All migrations complete");
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, "Migration failed");
      process.exit(1);
    });
}
