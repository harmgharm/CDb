/**
 * Migration 0016: Recommendation dismissals table
 *
 * Stores per-user "not interested" dismissals so they can be excluded
 * from future recommendations and optionally restored later.
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .createTable("recommendation_dismissals")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    // Item identity (at least one required)
    .addColumn("media_id", "uuid", (col) => col.references("media.id").onDelete("cascade"))
    .addColumn("tmdb_id", "integer")
    .addColumn("mal_id", "integer")
    // Cached display fields so the management UI can render without re-fetching
    .addColumn("ext_title", "varchar(500)")
    .addColumn("ext_poster_url", "text")
    .addColumn("ext_media_type", "varchar(20)")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Must have at least one identifier
  await sql`
    ALTER TABLE recommendation_dismissals
    ADD CONSTRAINT rec_dismissal_anchor_check
    CHECK (media_id IS NOT NULL OR tmdb_id IS NOT NULL OR mal_id IS NOT NULL)
  `.execute(db);

  // Prevent duplicate dismissals per user+media
  await sql`
    CREATE UNIQUE INDEX rec_dismissal_user_media_unique
    ON recommendation_dismissals (user_id, media_id)
    WHERE media_id IS NOT NULL
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX rec_dismissal_user_tmdb_unique
    ON recommendation_dismissals (user_id, tmdb_id)
    WHERE tmdb_id IS NOT NULL AND media_id IS NULL
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX rec_dismissal_user_mal_unique
    ON recommendation_dismissals (user_id, mal_id)
    WHERE mal_id IS NOT NULL AND media_id IS NULL
  `.execute(db);

  // Performance index
  await db.schema
    .createIndex("rec_dismissal_user_idx")
    .on("recommendation_dismissals")
    .column("user_id")
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.dropTable("recommendation_dismissals").execute();
}
