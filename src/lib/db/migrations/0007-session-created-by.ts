/**
 * Migration 0007: Add created_by_user_id to watch_sessions
 *
 * Tracks who created each session, allowing creators to edit/delete their sessions.
 * Backfills existing sessions by setting created_by = picked_by where available.
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await sql`
    ALTER TABLE watch_sessions
    ADD COLUMN created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL
  `.execute(db);

  // Backfill: set created_by to the picker for existing sessions
  await sql`
    UPDATE watch_sessions
    SET created_by_user_id = picked_by_user_id
    WHERE picked_by_user_id IS NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<never>): Promise<void> {
  await sql`
    ALTER TABLE watch_sessions
    DROP COLUMN IF EXISTS created_by_user_id
  `.execute(db);
}
