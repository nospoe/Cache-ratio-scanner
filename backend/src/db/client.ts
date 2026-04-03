import { Pool } from "pg";
import { logger } from "../utils/logger";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is required");
    }
    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err) => {
      logger.error({ err }, "Unexpected PostgreSQL pool error");
    });

    pool.on("connect", () => {
      logger.debug("New PostgreSQL client connected");
    });
  }
  return pool;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function query<T = Record<string, any>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const pool = getPool();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await pool.query<any>(sql, params);
  return result.rows as T[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryOne<T = Record<string, any>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
