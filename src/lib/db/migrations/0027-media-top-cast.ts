/**
 * Migration 0027: Add top_cast to media
 *
 * Stores top 8 cast members per movie/TV as JSONB array of
 * { id, name, character, profilePath } objects.
 */

import type { Kysely } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema.alterTable("media").addColumn("top_cast", "jsonb").execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.alterTable("media").dropColumn("top_cast").execute();
}
