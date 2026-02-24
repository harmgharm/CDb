/**
 * Transaction Helper
 *
 * Automatically commits on success, rolls back on error.
 */

import type { Transaction } from "kysely";

import { db } from "./client";
import type { Database } from "./types";

/**
 * Execute operations within a database transaction.
 *
 * @example
 * ```typescript
 * const session = await withTransaction(async (trx) => {
 *   const watchSession = await trx
 *     .insertInto("watch_sessions")
 *     .values({ ... })
 *     .returningAll()
 *     .executeTakeFirstOrThrow();
 *
 *   await trx
 *     .insertInto("session_attendees")
 *     .values({ session_id: watchSession.id, user_id: "..." })
 *     .execute();
 *
 *   return watchSession;
 * });
 * ```
 */
export async function withTransaction<T>(
  fn: (trx: Transaction<Database>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(fn);
}

/** Type alias for transaction parameter */
export type DatabaseTransaction = Transaction<Database>;
