/**
 * Migration 0028: Group queue (proposals + votes)
 *
 * The group queue: any member proposes a title, everyone upvotes, the top pick
 * auto-promotes into a dateless "scheduled" slot, and logging that pick as
 * watched advances the queue. Two dedicated tables keep the feature isolated
 * from stats / timeline / featured aggregates (no `watch_sessions` changes).
 *
 * DB-enforced invariants (partial unique indexes, hold under concurrency):
 *   - one active entry per media (status in 'proposed'/'scheduled')
 *   - at most one scheduled pick at a time
 *   - one vote per person per proposal
 * Vote counts are always derived (COUNT over queue_votes), never stored.
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema
    .createTable("queue_proposals")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("media_id", "uuid", (col) =>
      col.notNull().references("media.id").onDelete("cascade"),
    )
    // Proposer kept on user deletion so the proposal/history survives.
    .addColumn("proposed_by", "uuid", (col) => col.references("users.id").onDelete("set null"))
    .addColumn("status", "varchar(20)", (col) => col.notNull().defaultTo("proposed"))
    // null = "scheduled, no date yet"; set/changed by a member.
    .addColumn("scheduled_date", "date")
    // When promoted into the slot (ordering / history).
    .addColumn("scheduled_at", "timestamptz")
    // Links a watched proposal to its real session (Approach A).
    .addColumn("watched_session_id", "uuid", (col) =>
      col.references("watch_sessions.id").onDelete("set null"),
    )
    // Tie-break key (oldest proposal wins).
    .addColumn("proposed_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz")
    .execute();

  // Status must be one of the lifecycle values.
  await sql`
    ALTER TABLE queue_proposals
    ADD CONSTRAINT queue_proposals_status_check
    CHECK (status IN ('proposed', 'scheduled', 'watched'))
  `.execute(db);

  // One active entry per media (re-proposing a watched title is allowed).
  await sql`
    CREATE UNIQUE INDEX queue_proposals_active_media_unique
    ON queue_proposals (media_id)
    WHERE status IN ('proposed', 'scheduled')
  `.execute(db);

  // At most one scheduled pick at a time.
  await sql`
    CREATE UNIQUE INDEX queue_proposals_single_scheduled_unique
    ON queue_proposals (status)
    WHERE status = 'scheduled'
  `.execute(db);

  // Ranking / lookup helpers.
  await db.schema
    .createIndex("queue_proposals_status_idx")
    .on("queue_proposals")
    .column("status")
    .execute();

  await db.schema
    .createIndex("queue_proposals_media_id_idx")
    .on("queue_proposals")
    .column("media_id")
    .execute();

  await db.schema
    .createTable("queue_votes")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`uuid_generate_v4()`))
    .addColumn("proposal_id", "uuid", (col) =>
      col.notNull().references("queue_proposals.id").onDelete("cascade"),
    )
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("queue_votes_proposal_user_unique", ["proposal_id", "user_id"])
    .execute();

  // Vote tallies aggregate over proposal_id.
  await db.schema
    .createIndex("queue_votes_proposal_id_idx")
    .on("queue_votes")
    .column("proposal_id")
    .execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.dropTable("queue_votes").execute();
  await db.schema.dropTable("queue_proposals").execute();
}
