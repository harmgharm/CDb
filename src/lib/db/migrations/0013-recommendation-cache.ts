/**
 * Migration 0013: Recommendation cache tables
 *
 * Two tables for the recommendation engine:
 * 1. recommendation_cache — stores computed per-user and group recommendations
 * 2. tmdb_recommendation_cache — caches raw TMDB/Jikan API recommendation responses
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  // ── recommendation_cache ─────────────────────────────────────────────
  await db.schema
    .createTable("recommendation_cache")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("user_id", "uuid", (col) => col.references("users.id").onDelete("cascade"))
    .addColumn("rec_type", "varchar(30)", (col) => col.notNull())
    // Recommended item identity (imported or external)
    .addColumn("media_id", "uuid", (col) => col.references("media.id").onDelete("cascade"))
    .addColumn("tmdb_id", "integer")
    .addColumn("mal_id", "integer")
    // Cached display fields for unimported titles
    .addColumn("ext_title", "varchar(500)")
    .addColumn("ext_poster_url", "text")
    .addColumn("ext_media_type", "varchar(20)")
    .addColumn("ext_overview", "text")
    .addColumn("ext_release_year", "integer")
    .addColumn("ext_vote_average", sql`numeric(4,2)`)
    // Scoring and explanation
    .addColumn("score", sql`numeric(5,3)`, (col) => col.notNull())
    .addColumn("reasons", "jsonb", (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    // Cache management
    .addColumn("computed_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .execute();

  // Must reference at least one media identifier
  await sql`
    ALTER TABLE recommendation_cache
    ADD CONSTRAINT rec_cache_anchor_check
    CHECK (media_id IS NOT NULL OR tmdb_id IS NOT NULL OR mal_id IS NOT NULL)
  `.execute(db);

  // Valid rec_type values
  await sql`
    ALTER TABLE recommendation_cache
    ADD CONSTRAINT rec_cache_type_check
    CHECK (rec_type IN ('content', 'collaborative', 'tmdb', 'jikan', 'group'))
  `.execute(db);

  // Prevent duplicate recs per user+type+media
  await sql`
    CREATE UNIQUE INDEX rec_cache_user_type_media_unique
    ON recommendation_cache (user_id, rec_type, media_id)
    WHERE media_id IS NOT NULL
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX rec_cache_user_type_tmdb_unique
    ON recommendation_cache (user_id, rec_type, tmdb_id)
    WHERE tmdb_id IS NOT NULL AND media_id IS NULL
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX rec_cache_user_type_mal_unique
    ON recommendation_cache (user_id, rec_type, mal_id)
    WHERE mal_id IS NOT NULL AND media_id IS NULL
  `.execute(db);

  // Performance indexes
  await db.schema
    .createIndex("rec_cache_user_type_idx")
    .on("recommendation_cache")
    .columns(["user_id", "rec_type"])
    .execute();

  await db.schema
    .createIndex("rec_cache_expires_idx")
    .on("recommendation_cache")
    .column("expires_at")
    .execute();

  // ── tmdb_recommendation_cache ────────────────────────────────────────
  await db.schema
    .createTable("tmdb_recommendation_cache")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("source_type", "varchar(10)", (col) => col.notNull())
    .addColumn("source_tmdb_id", "integer")
    .addColumn("source_mal_id", "integer")
    .addColumn("recommendations", "jsonb", (col) => col.notNull())
    .addColumn("fetched_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .execute();

  // Must have at least one source identifier
  await sql`
    ALTER TABLE tmdb_recommendation_cache
    ADD CONSTRAINT tmdb_rec_source_check
    CHECK (source_tmdb_id IS NOT NULL OR source_mal_id IS NOT NULL)
  `.execute(db);

  // One cache entry per source media
  await sql`
    CREATE UNIQUE INDEX tmdb_rec_cache_tmdb_unique
    ON tmdb_recommendation_cache (source_type, source_tmdb_id)
    WHERE source_tmdb_id IS NOT NULL
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX tmdb_rec_cache_mal_unique
    ON tmdb_recommendation_cache (source_type, source_mal_id)
    WHERE source_mal_id IS NOT NULL
  `.execute(db);

  await db.schema
    .createIndex("tmdb_rec_cache_expires_idx")
    .on("tmdb_recommendation_cache")
    .column("expires_at")
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.dropTable("tmdb_recommendation_cache").execute();
  await db.schema.dropTable("recommendation_cache").execute();
}
