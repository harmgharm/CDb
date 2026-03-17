/**
 * Migration 0018: Notification preferences table
 *
 * Per-user JSONB preferences for notification opt-out.
 * Missing keys = enabled (opt-out model with empty default).
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .createTable("notification_preferences")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("user_id", "uuid", (col) =>
      col.notNull().unique().references("users.id").onDelete("cascade"),
    )
    .addColumn("preferences", "jsonb", (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.dropTable("notification_preferences").execute();
}
