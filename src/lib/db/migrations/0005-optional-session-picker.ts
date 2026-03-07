/**
 * Migration 0005: Make session picker optional (nullable)
 *
 * Allows watch sessions without a specific picker (group decision).
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await sql`ALTER TABLE watch_sessions ALTER COLUMN picked_by_user_id DROP NOT NULL`.execute(db);
}

export async function down(db: Kysely<never>): Promise<void> {
  // Backfill any NULLs with the first attendee before re-adding constraint
  await sql`
    UPDATE watch_sessions
    SET picked_by_user_id = (
      SELECT user_id FROM session_attendees
      WHERE session_id = watch_sessions.id
      LIMIT 1
    )
    WHERE picked_by_user_id IS NULL
  `.execute(db);
  await sql`ALTER TABLE watch_sessions ALTER COLUMN picked_by_user_id SET NOT NULL`.execute(db);
}
