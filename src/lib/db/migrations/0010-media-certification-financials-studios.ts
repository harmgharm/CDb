/**
 * Migration 0010: Add certification, networks, financials, and studios to media
 *
 * New columns: certification, networks, budget, revenue, studios
 */

import type { Kysely } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .alterTable("media")
    .addColumn("certification", "varchar(20)")
    .addColumn("networks", "jsonb")
    .addColumn("budget", "bigint")
    .addColumn("revenue", "bigint")
    .addColumn("studios", "jsonb")
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema
    .alterTable("media")
    .dropColumn("certification")
    .dropColumn("networks")
    .dropColumn("budget")
    .dropColumn("revenue")
    .dropColumn("studios")
    .execute();
}
