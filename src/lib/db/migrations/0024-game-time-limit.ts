/**
 * Migration 0024: Add time_limit_seconds to game_sessions
 *
 * Allows per-game customization of the round timer (1-15 seconds).
 * NULL means "use engine default" (10s for rating_guess, 15s for poster_reveal).
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await sql`
    ALTER TABLE game_sessions
    ADD COLUMN time_limit_seconds smallint
    CHECK (time_limit_seconds IS NULL OR (time_limit_seconds >= 1 AND time_limit_seconds <= 15))
  `.execute(db);
}

export async function down(db: Kysely<never>): Promise<void> {
  await sql`
    ALTER TABLE game_sessions
    DROP COLUMN IF EXISTS time_limit_seconds
  `.execute(db);
}
