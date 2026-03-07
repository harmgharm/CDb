/**
 * Migration 0006: Change picker FK from CASCADE to SET NULL on user deletion
 *
 * When a user is deleted, their sessions as picker should remain
 * with picker set to null (group pick) instead of being cascade-deleted.
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  // Find and drop the existing FK constraint on picked_by_user_id
  await sql`
    ALTER TABLE watch_sessions
    DROP CONSTRAINT IF EXISTS watch_sessions_picked_by_user_id_fkey
  `.execute(db);

  // Re-add with ON DELETE SET NULL
  await sql`
    ALTER TABLE watch_sessions
    ADD CONSTRAINT watch_sessions_picked_by_user_id_fkey
    FOREIGN KEY (picked_by_user_id) REFERENCES users(id) ON DELETE SET NULL
  `.execute(db);
}

export async function down(db: Kysely<never>): Promise<void> {
  await sql`
    ALTER TABLE watch_sessions
    DROP CONSTRAINT IF EXISTS watch_sessions_picked_by_user_id_fkey
  `.execute(db);

  await sql`
    ALTER TABLE watch_sessions
    ADD CONSTRAINT watch_sessions_picked_by_user_id_fkey
    FOREIGN KEY (picked_by_user_id) REFERENCES users(id) ON DELETE CASCADE
  `.execute(db);
}
