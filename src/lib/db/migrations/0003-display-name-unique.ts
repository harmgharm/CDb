/**
 * Add unique constraint on display_name
 *
 * Also adds a unique index on LOWER(username) for case-insensitive
 * username uniqueness and normalizes existing usernames to lowercase.
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  // Normalize existing usernames to lowercase
  await sql`UPDATE users SET username = LOWER(username)`.execute(db);

  // Add case-insensitive unique index on username
  await db.schema
    .createIndex("users_username_lower_idx")
    .on("users")
    .expression(sql`LOWER(username)`)
    .unique()
    .execute();

  // Add unique constraint on display_name (only for non-null values)
  await db.schema
    .createIndex("users_display_name_unique_idx")
    .on("users")
    .column("display_name")
    .unique()
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.dropIndex("users_display_name_unique_idx").execute();
  await db.schema.dropIndex("users_username_lower_idx").execute();
}
