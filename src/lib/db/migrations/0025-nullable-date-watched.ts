/**
 * Migration 0025: Make date_watched nullable on watch_sessions
 *
 * Allows logging sessions where the exact watch date is unknown (e.g. old
 * titles the group watched ages ago). Stats and streaks that depend on
 * date_watched already filter by date range, so NULLs are naturally excluded.
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await sql`
    ALTER TABLE watch_sessions
    ALTER COLUMN date_watched DROP NOT NULL
  `.execute(db);
}

export async function down(db: Kysely<never>): Promise<void> {
  // Backfill any NULLs with the session's created_at date before restoring NOT NULL
  await sql`
    UPDATE watch_sessions
    SET date_watched = created_at::date
    WHERE date_watched IS NULL
  `.execute(db);

  await sql`
    ALTER TABLE watch_sessions
    ALTER COLUMN date_watched SET NOT NULL
  `.execute(db);
}
