/**
 * Migration 0012: Watchlist table
 *
 * Personal watchlist per user. Each row links a user to a title they
 * want to watch. Titles can be already-imported media (media_id FK) or
 * unimported external references (tmdb_id / mal_id with cached display fields).
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .createTable("watchlist")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("media_id", "uuid", (col) => col.references("media.id").onDelete("cascade"))
    // Cached display fields for unimported titles
    .addColumn("ext_title", "varchar(500)")
    .addColumn("ext_poster_url", "text")
    .addColumn("ext_media_type", "varchar(20)")
    .addColumn("tmdb_id", "integer")
    .addColumn("mal_id", "integer")
    // Status and notes
    .addColumn("status", "varchar(20)", (col) => col.notNull().defaultTo("planning"))
    .addColumn("notes", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz")
    .execute();

  // Unique: one entry per imported media per user
  await sql`
    CREATE UNIQUE INDEX watchlist_user_media_unique
    ON watchlist (user_id, media_id)
    WHERE media_id IS NOT NULL
  `.execute(db);

  // Unique: one TMDB entry per user (unimported only)
  await sql`
    CREATE UNIQUE INDEX watchlist_user_tmdb_unique
    ON watchlist (user_id, tmdb_id)
    WHERE tmdb_id IS NOT NULL AND media_id IS NULL
  `.execute(db);

  // Unique: one MAL entry per user (unimported only)
  await sql`
    CREATE UNIQUE INDEX watchlist_user_mal_unique
    ON watchlist (user_id, mal_id)
    WHERE mal_id IS NOT NULL AND media_id IS NULL
  `.execute(db);

  // Must have either media_id OR at least one external ID
  await sql`
    ALTER TABLE watchlist
    ADD CONSTRAINT watchlist_anchor_check
    CHECK (
      (media_id IS NOT NULL AND tmdb_id IS NULL AND mal_id IS NULL)
      OR
      (media_id IS NULL AND (tmdb_id IS NOT NULL OR mal_id IS NOT NULL))
    )
  `.execute(db);

  // Status must be one of the allowed values
  await sql`
    ALTER TABLE watchlist
    ADD CONSTRAINT watchlist_status_check
    CHECK (status IN ('planning', 'watching', 'scrapped'))
  `.execute(db);

  // Performance indexes
  await db.schema.createIndex("watchlist_user_id_idx").on("watchlist").column("user_id").execute();

  await db.schema
    .createIndex("watchlist_media_id_idx")
    .on("watchlist")
    .column("media_id")
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.dropTable("watchlist").execute();
}
