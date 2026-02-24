/**
 * Initial Schema Migration
 *
 * Creates core tables: users, media, watch_sessions, session_attendees,
 * ratings, invite_codes, audit_log
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  // Enable uuid-ossp extension for uuid_generate_v4()
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);

  // ============================================
  // USERS
  // ============================================
  await db.schema
    .createTable("users")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("username", "varchar(50)", (col) => col.notNull().unique())
    .addColumn("email", "varchar(255)", (col) => col.notNull().unique())
    .addColumn("password_hash", "text", (col) => col.notNull())
    .addColumn("display_name", "varchar(100)")
    .addColumn("avatar_url", "text")
    .addColumn("role", "varchar(20)", (col) => col.notNull().defaultTo("member"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz")
    .execute();

  // ============================================
  // MEDIA
  // ============================================
  await db.schema
    .createTable("media")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("title", "varchar(500)", (col) => col.notNull())
    .addColumn("type", "varchar(20)", (col) => col.notNull())
    .addColumn("tmdb_id", "integer")
    .addColumn("mal_id", "integer")
    .addColumn("poster_url", "text")
    .addColumn("backdrop_url", "text")
    .addColumn("synopsis", "text")
    .addColumn("genres", "jsonb", (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn("release_year", "integer")
    .addColumn("episode_count", "integer")
    .addColumn("runtime_minutes", "integer")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz")
    .execute();

  await db.schema.createIndex("media_tmdb_id_idx").on("media").column("tmdb_id").execute();

  await db.schema.createIndex("media_mal_id_idx").on("media").column("mal_id").execute();

  await db.schema.createIndex("media_type_idx").on("media").column("type").execute();

  // ============================================
  // WATCH SESSIONS
  // ============================================
  await db.schema
    .createTable("watch_sessions")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("media_id", "uuid", (col) =>
      col.notNull().references("media.id").onDelete("cascade"),
    )
    .addColumn("date_watched", "date", (col) => col.notNull())
    .addColumn("time_watched_at", "varchar(10)")
    .addColumn("picked_by_user_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("notes", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz")
    .execute();

  await db.schema
    .createIndex("watch_sessions_media_id_idx")
    .on("watch_sessions")
    .column("media_id")
    .execute();

  await db.schema
    .createIndex("watch_sessions_date_watched_idx")
    .on("watch_sessions")
    .column("date_watched")
    .execute();

  // ============================================
  // SESSION ATTENDEES
  // ============================================
  await db.schema
    .createTable("session_attendees")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("session_id", "uuid", (col) =>
      col.notNull().references("watch_sessions.id").onDelete("cascade"),
    )
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("session_attendees_unique", ["session_id", "user_id"])
    .execute();

  // ============================================
  // RATINGS
  // ============================================
  await db.schema
    .createTable("ratings")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("session_id", "uuid", (col) =>
      col.notNull().references("watch_sessions.id").onDelete("cascade"),
    )
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("score", sql`decimal(3,1)`, (col) => col.notNull())
    .addColumn("review", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz")
    .addUniqueConstraint("ratings_unique", ["session_id", "user_id"])
    .execute();

  // Add check constraint for score range (1-10)
  await sql`ALTER TABLE ratings ADD CONSTRAINT ratings_score_range CHECK (score >= 1 AND score <= 10)`.execute(
    db,
  );

  // ============================================
  // INVITE CODES
  // ============================================
  await db.schema
    .createTable("invite_codes")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("code", "varchar(50)", (col) => col.notNull().unique())
    .addColumn("created_by_user_id", "uuid", (col) =>
      col.notNull().references("users.id").onDelete("cascade"),
    )
    .addColumn("used_by_user_id", "uuid", (col) => col.references("users.id").onDelete("set null"))
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex("invite_codes_code_idx").on("invite_codes").column("code").execute();

  // ============================================
  // AUDIT LOG
  // ============================================
  await db.schema
    .createTable("audit_log")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("action", "varchar(50)", (col) => col.notNull())
    .addColumn("entity_type", "varchar(50)", (col) => col.notNull())
    .addColumn("entity_id", "uuid", (col) => col.notNull())
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex("audit_log_user_id_idx").on("audit_log").column("user_id").execute();

  await db.schema
    .createIndex("audit_log_created_at_idx")
    .on("audit_log")
    .column("created_at")
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.dropTable("audit_log").execute();
  await db.schema.dropTable("invite_codes").execute();
  await db.schema.dropTable("ratings").execute();
  await db.schema.dropTable("session_attendees").execute();
  await db.schema.dropTable("watch_sessions").execute();
  await db.schema.dropTable("media").execute();
  await db.schema.dropTable("users").execute();
}
