/**
 * Migration 0022: Generalize game tables for multi-game support
 *
 * Changes:
 * - game_rounds: add round_data JSONB, make poster_url/title nullable
 * - game_guesses: add guess_data JSONB, make guess_text nullable
 * - game_sessions: update game_type constraint to allow 'rating_guess'
 * - game_leaderboard: add game_type column, update unique/sort indexes
 * - Backfill round_data and leaderboard game_type for existing data
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  // ── game_rounds: add round_data JSONB ────────────────────────
  await db.schema.alterTable("game_rounds").addColumn("round_data", "jsonb").execute();

  // Make poster_url and title nullable
  await sql`ALTER TABLE game_rounds ALTER COLUMN poster_url DROP NOT NULL`.execute(db);
  await sql`ALTER TABLE game_rounds ALTER COLUMN title DROP NOT NULL`.execute(db);

  // Backfill round_data from legacy columns
  await sql`
    UPDATE game_rounds
    SET round_data = jsonb_build_object(
      'posterUrl', poster_url,
      'title', title,
      'mediaId', media_id,
      'tmdbId', tmdb_id,
      'malId', mal_id
    )
    WHERE round_data IS NULL
  `.execute(db);

  // ── game_guesses: add guess_data JSONB ───────────────────────
  await db.schema.alterTable("game_guesses").addColumn("guess_data", "jsonb").execute();

  // Make guess_text nullable
  await sql`ALTER TABLE game_guesses ALTER COLUMN guess_text DROP NOT NULL`.execute(db);

  // ── game_sessions: update game_type constraint ───────────────
  await sql`ALTER TABLE game_sessions DROP CONSTRAINT game_sessions_game_type_check`.execute(db);
  await sql`
    ALTER TABLE game_sessions
    ADD CONSTRAINT game_sessions_game_type_check
    CHECK (game_type IN ('poster_reveal', 'rating_guess'))
  `.execute(db);

  // ── game_leaderboard: add game_type column ───────────────────
  await db.schema
    .alterTable("game_leaderboard")
    .addColumn("game_type", "varchar(50)", (col) => col.notNull().defaultTo("poster_reveal"))
    .execute();

  // Drop old unique index (user_id, category)
  await sql`DROP INDEX IF EXISTS game_leaderboard_user_category_unique`.execute(db);

  // Recreate unique index with game_type
  await sql`
    CREATE UNIQUE INDEX game_leaderboard_user_gametype_category_unique
    ON game_leaderboard (user_id, game_type, category)
  `.execute(db);

  // Drop old sort index
  await sql`DROP INDEX IF EXISTS game_leaderboard_category_score_idx`.execute(db);

  // Recreate sort index with game_type
  await sql`
    CREATE INDEX game_leaderboard_gametype_category_score_idx
    ON game_leaderboard (game_type, category, best_score DESC, avg_guess_time_ms ASC)
  `.execute(db);
}

export async function down(db: Kysely<never>): Promise<void> {
  // ── game_leaderboard: revert ─────────────────────────────────
  await sql`DROP INDEX IF EXISTS game_leaderboard_gametype_category_score_idx`.execute(db);
  await sql`DROP INDEX IF EXISTS game_leaderboard_user_gametype_category_unique`.execute(db);

  await db.schema.alterTable("game_leaderboard").dropColumn("game_type").execute();

  await sql`
    CREATE UNIQUE INDEX game_leaderboard_user_category_unique
    ON game_leaderboard (user_id, category)
  `.execute(db);

  await sql`
    CREATE INDEX game_leaderboard_category_score_idx
    ON game_leaderboard (category, best_score DESC)
  `.execute(db);

  // ── game_sessions: revert constraint ─────────────────────────
  await sql`ALTER TABLE game_sessions DROP CONSTRAINT game_sessions_game_type_check`.execute(db);
  await sql`
    ALTER TABLE game_sessions
    ADD CONSTRAINT game_sessions_game_type_check
    CHECK (game_type IN ('poster_reveal'))
  `.execute(db);

  // ── game_guesses: revert ─────────────────────────────────────
  await sql`ALTER TABLE game_guesses ALTER COLUMN guess_text SET NOT NULL`.execute(db);
  await db.schema.alterTable("game_guesses").dropColumn("guess_data").execute();

  // ── game_rounds: revert ──────────────────────────────────────
  await sql`ALTER TABLE game_rounds ALTER COLUMN poster_url SET NOT NULL`.execute(db);
  await sql`ALTER TABLE game_rounds ALTER COLUMN title SET NOT NULL`.execute(db);
  await db.schema.alterTable("game_rounds").dropColumn("round_data").execute();
}
