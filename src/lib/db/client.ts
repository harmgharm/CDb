/**
 * Database Client
 *
 * Kysely client with Neon serverless Pool (WebSocket).
 * Uses PostgresDialect with @neondatabase/serverless Pool
 * which is pg-compatible and supports transactions.
 */

import { neonConfig, Pool } from "@neondatabase/serverless";
import { Kysely, PostgresDialect } from "kysely";
import ws from "ws";

import { env } from "@/lib/env";

import type { Database } from "./types";

// Configure WebSocket for Node.js (serverless functions)
neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

/**
 * Kysely database instance
 *
 * Type-safe query builder for Neon Postgres.
 *
 * @example
 * ```typescript
 * import { db } from "@/lib/db";
 *
 * const users = await db
 *   .selectFrom("users")
 *   .selectAll()
 *   .execute();
 * ```
 */
export const db = new Kysely<Database>({
  dialect: new PostgresDialect({ pool }),
});

/**
 * Close the database connection pool.
 * Call during graceful shutdown.
 */
export async function closeDatabase(): Promise<void> {
  await db.destroy();
}

/**
 * Check database connectivity.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.selectFrom("users").select("id").limit(1).execute();
    return true;
  } catch {
    return false;
  }
}
