/**
 * Migration 0023: Drop legacy round columns
 *
 * Now that all game logic reads from round_data JSONB, the legacy
 * columns on game_rounds (media_id, tmdb_id, mal_id, poster_url, title)
 * are no longer needed.
 *
 * NOTE: This is destructive — the data already exists in round_data JSONB
 * (backfilled in migration 0022), so nothing is lost.
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .alterTable("game_rounds")
    .dropColumn("media_id")
    .dropColumn("tmdb_id")
    .dropColumn("mal_id")
    .dropColumn("poster_url")
    .dropColumn("title")
    .execute();

  // Make round_data NOT NULL now that it's the source of truth
  await sql`ALTER TABLE game_rounds ALTER COLUMN round_data SET NOT NULL`.execute(db);
}

export async function down(db: Kysely<never>): Promise<void> {
  // Revert round_data to nullable
  await sql`ALTER TABLE game_rounds ALTER COLUMN round_data DROP NOT NULL`.execute(db);

  // Re-add legacy columns
  await db.schema
    .alterTable("game_rounds")
    .addColumn("media_id", "uuid")
    .addColumn("tmdb_id", "integer")
    .addColumn("mal_id", "integer")
    .addColumn("poster_url", "varchar(500)")
    .addColumn("title", "varchar(500)")
    .execute();

  // Backfill from round_data
  await sql`
    UPDATE game_rounds
    SET
      media_id = (round_data->>'mediaId')::uuid,
      tmdb_id = (round_data->>'tmdbId')::integer,
      mal_id = (round_data->>'malId')::integer,
      poster_url = round_data->>'posterUrl',
      title = round_data->>'title'
    WHERE round_data IS NOT NULL
  `.execute(db);
}
