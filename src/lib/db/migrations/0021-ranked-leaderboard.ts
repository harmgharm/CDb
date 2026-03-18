/**
 * Migration 0021: Ranked leaderboard system
 *
 * Changes:
 * - Adds `is_ranked` boolean to game_sessions
 * - Drops and recreates game_leaderboard with per-category best scores
 *   (replaces cumulative total_score with best single-game score)
 * - Backfills existing 5-round finished games as ranked
 * - Recomputes leaderboard from game data
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  // ── Add is_ranked to game_sessions ─────────────────────────────
  await db.schema
    .alterTable("game_sessions")
    .addColumn("is_ranked", "boolean", (col) => col.notNull().defaultTo(false))
    .execute();

  // Backfill: existing 5-round finished games are ranked
  await sql`
    UPDATE game_sessions
    SET is_ranked = true
    WHERE round_count = 5 AND status = 'finished'
  `.execute(db);

  // ── Recreate game_leaderboard ──────────────────────────────────
  // Drop old table (cumulative total_score, unique on user_id)
  await db.schema.dropTable("game_leaderboard").execute();

  // New table: per-category best scores
  await db.schema
    .createTable("game_leaderboard")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("category", "varchar(20)", (col) => col.notNull().defaultTo("normal_ranked"))
    .addColumn("best_score", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("best_score_game_id", "uuid", (col) =>
      col.references("game_sessions.id").onDelete("set null"),
    )
    .addColumn("games_played", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("games_won", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("rounds_won", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("best_streak", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("avg_guess_time_ms", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await sql`
    ALTER TABLE game_leaderboard
    ADD CONSTRAINT game_leaderboard_category_check
    CHECK (category IN ('normal_ranked', 'hard_ranked'))
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX game_leaderboard_user_category_unique
    ON game_leaderboard (user_id, category)
  `.execute(db);

  await sql`
    CREATE INDEX game_leaderboard_category_score_idx
    ON game_leaderboard (category, best_score DESC)
  `.execute(db);

  // ── Backfill leaderboard from existing ranked games ────────────
  // This inserts one row per user+category with their best single-game
  // score, computed from game_guesses. Uses a CTE to aggregate per-game
  // stats, then picks the best score per user+category.
  await sql`
    WITH game_stats AS (
      SELECT
        gs.id AS game_id,
        gs.created_by_user_id AS user_id,
        CASE WHEN gs.difficulty = 'hard' THEN 'hard_ranked' ELSE 'normal_ranked' END AS category,
        COALESCE(SUM(gg.score_awarded), 0)::integer AS total_score,
        COUNT(*) FILTER (WHERE gg.is_correct)::integer AS rounds_won,
        COALESCE(AVG(gg.time_from_start_ms) FILTER (WHERE gg.is_correct), 0)::integer AS avg_time
      FROM game_sessions gs
      JOIN game_rounds gr ON gr.game_id = gs.id
      LEFT JOIN game_guesses gg ON gg.round_id = gr.id AND gg.user_id = gs.created_by_user_id
      WHERE gs.is_ranked = true AND gs.status = 'finished' AND gs.mode = 'solo'
      GROUP BY gs.id, gs.created_by_user_id, gs.difficulty
    ),
    best_per_user AS (
      SELECT DISTINCT ON (user_id, category)
        user_id,
        category,
        game_id,
        total_score,
        rounds_won,
        avg_time
      FROM game_stats
      ORDER BY user_id, category, total_score DESC
    ),
    counts AS (
      SELECT user_id, category, COUNT(*)::integer AS games_played
      FROM game_stats
      GROUP BY user_id, category
    )
    INSERT INTO game_leaderboard (user_id, category, best_score, best_score_game_id, games_played, rounds_won, avg_guess_time_ms)
    SELECT
      bp.user_id,
      bp.category,
      bp.total_score,
      bp.game_id,
      c.games_played,
      bp.rounds_won,
      bp.avg_time
    FROM best_per_user bp
    JOIN counts c ON c.user_id = bp.user_id AND c.category = bp.category
  `.execute(db);
}

export async function down(db: Kysely<never>): Promise<void> {
  // Drop new leaderboard
  await db.schema.dropTable("game_leaderboard").execute();

  // Recreate old leaderboard structure
  await db.schema
    .createTable("game_leaderboard")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("user_id", "uuid", (col) =>
      col.notNull().unique().references("users.id").onDelete("cascade"),
    )
    .addColumn("games_played", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("games_won", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("rounds_won", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("total_score", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("best_streak", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("avg_guess_time_ms", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("game_leaderboard_total_score_idx")
    .on("game_leaderboard")
    .column("total_score desc")
    .execute();

  // Remove is_ranked column
  await db.schema.alterTable("game_sessions").dropColumn("is_ranked").execute();
}
