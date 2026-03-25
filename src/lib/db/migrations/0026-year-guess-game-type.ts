/**
 * Migration 0026: Add 'year_guess' to game_type constraint
 *
 * Extends the game_sessions CHECK constraint to allow the new Year Guesser game type.
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await sql`ALTER TABLE game_sessions DROP CONSTRAINT game_sessions_game_type_check`.execute(db);
  await sql`
    ALTER TABLE game_sessions
    ADD CONSTRAINT game_sessions_game_type_check
    CHECK (game_type IN ('poster_reveal', 'rating_guess', 'year_guess'))
  `.execute(db);
}

export async function down(db: Kysely<never>): Promise<void> {
  await sql`ALTER TABLE game_sessions DROP CONSTRAINT game_sessions_game_type_check`.execute(db);
  await sql`
    ALTER TABLE game_sessions
    ADD CONSTRAINT game_sessions_game_type_check
    CHECK (game_type IN ('poster_reveal', 'rating_guess'))
  `.execute(db);
}
