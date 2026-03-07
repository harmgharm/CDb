/**
 * Migration 0011: Make audit_log.entity_id nullable
 *
 * Allows bulk operations (e.g., media.bulk_refresh) to log
 * without referencing a specific entity.
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await sql`ALTER TABLE audit_log ALTER COLUMN entity_id DROP NOT NULL`.execute(db);
}

export async function down(db: Kysely<never>): Promise<void> {
  await sql`ALTER TABLE audit_log ALTER COLUMN entity_id SET NOT NULL`.execute(db);
}
