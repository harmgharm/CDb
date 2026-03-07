/**
 * Migration 0004: Add directors, external ratings, and IMDB ID to media
 */

import type { Kysely } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .alterTable("media")
    .addColumn("directors", "jsonb")
    .addColumn("imdb_id", "varchar(20)")
    .addColumn("tmdb_rating", "real")
    .addColumn("mal_score", "real")
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema
    .alterTable("media")
    .dropColumn("directors")
    .dropColumn("imdb_id")
    .dropColumn("tmdb_rating")
    .dropColumn("mal_score")
    .execute();
}
