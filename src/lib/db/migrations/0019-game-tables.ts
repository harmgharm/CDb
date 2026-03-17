/**
 * Migration 0019: Game tables
 *
 * Adds tables for the Poster Reveal Guessing Game:
 * - game_sessions: one row per game (solo or multiplayer)
 * - game_rounds: one row per round within a game
 * - game_guesses: individual guess attempts
 * - game_leaderboard: aggregated per-user stats
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  // ── game_sessions ──────────────────────────────────────────────
  await db.schema
    .createTable("game_sessions")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("mode", "varchar(20)", (col) => col.notNull())
    .addColumn("difficulty", "varchar(20)", (col) => col.notNull())
    .addColumn("status", "varchar(20)", (col) => col.notNull().defaultTo("lobby"))
    .addColumn("round_count", "integer", (col) => col.notNull().defaultTo(5))
    .addColumn("current_round", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_by_user_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("started_at", "timestamptz")
    .addColumn("finished_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await sql`
    ALTER TABLE game_sessions
    ADD CONSTRAINT game_sessions_mode_check
    CHECK (mode IN ('solo', 'multiplayer'))
  `.execute(db);

  await sql`
    ALTER TABLE game_sessions
    ADD CONSTRAINT game_sessions_difficulty_check
    CHECK (difficulty IN ('normal', 'hard'))
  `.execute(db);

  await sql`
    ALTER TABLE game_sessions
    ADD CONSTRAINT game_sessions_status_check
    CHECK (status IN ('lobby', 'active', 'finished'))
  `.execute(db);

  await db.schema
    .createIndex("game_sessions_created_by_idx")
    .on("game_sessions")
    .column("created_by_user_id")
    .execute();

  await db.schema
    .createIndex("game_sessions_status_idx")
    .on("game_sessions")
    .column("status")
    .execute();

  // ── game_rounds ────────────────────────────────────────────────
  await db.schema
    .createTable("game_rounds")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("game_id", "uuid", (col) =>
      col.notNull().references("game_sessions.id").onDelete("cascade"),
    )
    .addColumn("round_number", "integer", (col) => col.notNull())
    .addColumn("media_id", "uuid", (col) => col.references("media.id").onDelete("set null"))
    .addColumn("tmdb_id", "integer")
    .addColumn("mal_id", "integer")
    .addColumn("poster_url", "varchar(500)", (col) => col.notNull())
    .addColumn("title", "varchar(500)", (col) => col.notNull())
    .addColumn("started_at", "timestamptz")
    .addColumn("ended_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await sql`
    CREATE UNIQUE INDEX game_rounds_game_round_unique
    ON game_rounds (game_id, round_number)
  `.execute(db);

  await db.schema
    .createIndex("game_rounds_game_id_idx")
    .on("game_rounds")
    .column("game_id")
    .execute();

  // ── game_guesses ───────────────────────────────────────────────
  await db.schema
    .createTable("game_guesses")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("round_id", "uuid", (col) =>
      col.notNull().references("game_rounds.id").onDelete("cascade"),
    )
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("guess_text", "varchar(500)", (col) => col.notNull())
    .addColumn("matched_media_id", "uuid", (col) => col.references("media.id").onDelete("set null"))
    .addColumn("is_correct", "boolean", (col) => col.notNull())
    .addColumn("time_from_start_ms", "integer", (col) => col.notNull())
    .addColumn("score_awarded", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("game_guesses_round_id_idx")
    .on("game_guesses")
    .column("round_id")
    .execute();

  await db.schema
    .createIndex("game_guesses_user_id_idx")
    .on("game_guesses")
    .column("user_id")
    .execute();

  // ── game_leaderboard ──────────────────────────────────────────
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
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.dropTable("game_guesses").execute();
  await db.schema.dropTable("game_rounds").execute();
  await db.schema.dropTable("game_leaderboard").execute();
  await db.schema.dropTable("game_sessions").execute();
}
