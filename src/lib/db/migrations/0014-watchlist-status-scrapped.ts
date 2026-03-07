/**
 * Migration 0014: Update watchlist status constraint
 *
 * The original migration (0012) was edited after running to change
 * 'dropped' → 'scrapped', but the DB constraint still has 'dropped'.
 * This migration:
 *  1. Updates any existing rows with status 'dropped' → 'scrapped'
 *  2. Replaces the CHECK constraint to allow 'scrapped' instead of 'dropped'
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  // Update any existing rows that still have 'dropped'
  await sql`UPDATE watchlist SET status = 'scrapped' WHERE status = 'dropped'`.execute(db);

  // Drop old constraint and add new one
  await sql`ALTER TABLE watchlist DROP CONSTRAINT IF EXISTS watchlist_status_check`.execute(db);
  await sql`
    ALTER TABLE watchlist
    ADD CONSTRAINT watchlist_status_check
    CHECK (status IN ('planning', 'watching', 'scrapped'))
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`UPDATE watchlist SET status = 'dropped' WHERE status = 'scrapped'`.execute(db);
  await sql`ALTER TABLE watchlist DROP CONSTRAINT IF EXISTS watchlist_status_check`.execute(db);
  await sql`
    ALTER TABLE watchlist
    ADD CONSTRAINT watchlist_status_check
    CHECK (status IN ('planning', 'watching', 'dropped'))
  `.execute(db);
}
