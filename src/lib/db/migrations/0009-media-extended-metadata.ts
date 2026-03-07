/**
 * Migration 0009: Add extended metadata to media
 *
 * New columns: status, original_title, tagline, vote_count,
 * season_count, trailer_key, origin_country
 */

import type { Kysely } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .alterTable("media")
    .addColumn("status", "varchar(50)")
    .addColumn("original_title", "varchar(500)")
    .addColumn("tagline", "text")
    .addColumn("vote_count", "integer")
    .addColumn("season_count", "integer")
    .addColumn("trailer_key", "varchar(20)")
    .addColumn("origin_country", "jsonb")
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema
    .alterTable("media")
    .dropColumn("status")
    .dropColumn("original_title")
    .dropColumn("tagline")
    .dropColumn("vote_count")
    .dropColumn("season_count")
    .dropColumn("trailer_key")
    .dropColumn("origin_country")
    .execute();
}
