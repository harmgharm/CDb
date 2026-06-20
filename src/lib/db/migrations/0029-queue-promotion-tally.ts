/**
 * Migration 0029: Capture the promotion vote tally on queue proposals
 *
 * When a proposal is promoted into the scheduled slot, freeze the winning and
 * runner-up vote counts so the dashboard's "Won the vote, X to Y" line is a
 * historical fact. A live COUNT would drift: both the scheduled pick and the
 * runner-up stay votable after promotion. Nullable — only set on promotion;
 * rows that were never promoted (proposed, or directly seeded) leave them null.
 */

import type { Kysely } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema.alterTable("queue_proposals").addColumn("won_votes", "integer").execute();
  await db.schema.alterTable("queue_proposals").addColumn("runner_up_votes", "integer").execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.alterTable("queue_proposals").dropColumn("runner_up_votes").execute();
  await db.schema.alterTable("queue_proposals").dropColumn("won_votes").execute();
}
