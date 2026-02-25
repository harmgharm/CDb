/**
 * Refresh Tokens Migration
 *
 * Adds refresh_tokens table for JWT refresh token rotation
 * with reuse detection via token families.
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .createTable("refresh_tokens")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("token_hash", "text", (col) => col.notNull())
    .addColumn("family", "uuid", (col) => col.notNull())
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .addColumn("revoked_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createIndex("refresh_tokens_token_hash_idx")
    .on("refresh_tokens")
    .column("token_hash")
    .execute();

  await db.schema
    .createIndex("refresh_tokens_user_id_idx")
    .on("refresh_tokens")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("refresh_tokens_family_idx")
    .on("refresh_tokens")
    .column("family")
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.dropTable("refresh_tokens").execute();
}
