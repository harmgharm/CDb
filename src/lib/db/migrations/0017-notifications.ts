/**
 * Migration 0017: Notifications table
 *
 * Stores in-app notifications per user. Source of truth for notification
 * state; real-time delivery via Ably is best-effort on top.
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .createTable("notifications")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("type", "varchar(50)", (col) => col.notNull())
    .addColumn("title", "varchar(255)", (col) => col.notNull())
    .addColumn("body", "text", (col) => col.notNull())
    .addColumn("link", "varchar(500)")
    .addColumn("is_read", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("metadata", "jsonb")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Unread count query: WHERE user_id = ? AND is_read = false
  await sql`
    CREATE INDEX notifications_user_unread_idx
    ON notifications (user_id, is_read)
    WHERE is_read = false
  `.execute(db);

  // List query: WHERE user_id = ? ORDER BY created_at DESC
  await db.schema
    .createIndex("notifications_user_created_idx")
    .on("notifications")
    .columns(["user_id", "created_at"])
    .execute();

  // Cleanup TTL: WHERE created_at < cutoff
  await db.schema
    .createIndex("notifications_created_at_idx")
    .on("notifications")
    .column("created_at")
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.dropTable("notifications").execute();
}
