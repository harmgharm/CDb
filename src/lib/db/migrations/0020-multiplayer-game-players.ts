/**
 * Migration 0020: Multiplayer support
 *
 * Adds:
 * - game_players table: tracks players in multiplayer lobbies/games
 * - game_type column on game_sessions: future-proofs for multiple game types
 * - first_correct_at on game_rounds: tracks when first correct guess happened (for auto-advance countdown)
 * - game.invited audit action support (NotificationType update is in app code)
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  // ── game_players ──────────────────────────────────────────────
  await db.schema
    .createTable("game_players")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("game_id", "uuid", (col) =>
      col.notNull().references("game_sessions.id").onDelete("cascade"),
    )
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("is_host", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("joined_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await sql`
    CREATE UNIQUE INDEX game_players_game_user_unique
    ON game_players (game_id, user_id)
  `.execute(db);

  await db.schema
    .createIndex("game_players_game_id_idx")
    .on("game_players")
    .column("game_id")
    .execute();

  await db.schema
    .createIndex("game_players_user_id_idx")
    .on("game_players")
    .column("user_id")
    .execute();

  // ── game_type on game_sessions ────────────────────────────────
  await db.schema
    .alterTable("game_sessions")
    .addColumn("game_type", "varchar(50)", (col) => col.notNull().defaultTo("poster_reveal"))
    .execute();

  await sql`
    ALTER TABLE game_sessions
    ADD CONSTRAINT game_sessions_game_type_check
    CHECK (game_type IN ('poster_reveal'))
  `.execute(db);

  // ── first_correct_at on game_rounds ───────────────────────────
  await db.schema.alterTable("game_rounds").addColumn("first_correct_at", "timestamptz").execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.alterTable("game_rounds").dropColumn("first_correct_at").execute();

  await sql`ALTER TABLE game_sessions DROP CONSTRAINT game_sessions_game_type_check`.execute(db);
  await db.schema.alterTable("game_sessions").dropColumn("game_type").execute();

  await db.schema.dropTable("game_players").execute();
}
