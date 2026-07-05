/**
 * Group Queue E2E (slice 1)
 *
 * API-driven coverage of the SQL/route wiring that the Vitest unit layer can't
 * reach (per the spec §8 strategy): the partial unique indexes, vote idempotency
 * via the unique constraint, propose dedup, schedule guard, delete + audit, and
 * the `advanceQueueOnWatch` hook firing inside the POST /api/sessions
 * transaction — including the concurrent-double-log path the slice-1 review
 * hardened with FOR UPDATE.
 *
 * Runs against the e2e Neon branch. The admin is authenticated via the shared
 * storageState; the member is logged in into a second request context.
 */

import { neonConfig, Pool } from "@neondatabase/serverless";
import type { APIRequestContext } from "@playwright/test";
import { expect, request as playwrightRequest, test } from "@playwright/test";
import { Kysely, PostgresDialect } from "kysely";
import ws from "ws";

import { E2E_ADMIN, E2E_MEMBER, E2E_QUEUE_MEDIA_IDS } from "./constants";

neonConfig.webSocketConstructor = ws;

const [MEDIA_A, MEDIA_B, MEDIA_C] = E2E_QUEUE_MEDIA_IDS;

// Fake-but-unique tmdb_ids: media_external_id_check (migration 0030) requires every
// media row to carry at least one external id. Kept far from real ids used in tests.
const E2E_QUEUE_TMDB_BASE = 900_001;
const E2E_QUEUE_TMDB_IDS = E2E_QUEUE_MEDIA_IDS.map((_id, i) => E2E_QUEUE_TMDB_BASE + i);
const [TMDB_A] = E2E_QUEUE_TMDB_IDS;

const byName = (a: string, b: string): number => a.localeCompare(b);

type TestDb = Kysely<Record<string, Record<string, unknown>>>;

function createDb(): TestDb {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error("DATABASE_URL not set — is .env.test configured?");
  }
  return new Kysely({ dialect: new PostgresDialect({ pool: new Pool({ connectionString }) }) });
}

/** Reset queue + media test rows to a known-empty baseline before each test. */
async function resetQueue(db: TestDb): Promise<void> {
  await db
    .deleteFrom("queue_votes")
    .where(
      "proposal_id",
      "in",
      db.selectFrom("queue_proposals").select("id").where("media_id", "in", E2E_QUEUE_MEDIA_IDS),
    )
    .execute();
  await db.deleteFrom("queue_proposals").where("media_id", "in", E2E_QUEUE_MEDIA_IDS).execute();
  // Sessions that may have been created by the advance-hook tests.
  await db.deleteFrom("watch_sessions").where("media_id", "in", E2E_QUEUE_MEDIA_IDS).execute();
  // Watchlist rows must go before media: since migration 0030 deleting media
  // fires SET NULL on watchlist.media_id, and a leftover row would then trip
  // watchlist_anchor_check (or collide on watchlist_user_tmdb_unique next run).
  await db.deleteFrom("watchlist").where("media_id", "in", E2E_QUEUE_MEDIA_IDS).execute();
  await db.deleteFrom("watchlist").where("tmdb_id", "in", E2E_QUEUE_TMDB_IDS).execute();
  await db.deleteFrom("media").where("id", "in", E2E_QUEUE_MEDIA_IDS).execute();

  await db
    .insertInto("media")
    .values(
      E2E_QUEUE_MEDIA_IDS.map((id, i) => ({
        id,
        title: `Queue Test Media ${String(i + 1)}`,
        type: "movie",
        tmdb_id: E2E_QUEUE_TMDB_BASE + i,
      })),
    )
    .execute();
}

/** Insert a proposal directly with a controlled status/proposed_at/vote count. */
async function seedProposal(
  db: TestDb,
  options: {
    mediaId: string;
    status: "proposed" | "scheduled";
    proposedAt: string;
    voterIds?: string[];
  },
): Promise<string> {
  const row = (await db
    .insertInto("queue_proposals")
    .values({
      media_id: options.mediaId,
      proposed_by: E2E_ADMIN.id,
      status: options.status,
      proposed_at: options.proposedAt,
      ...(options.status === "scheduled" ? { scheduled_at: options.proposedAt } : {}),
    })
    .returning("id")
    .executeTakeFirstOrThrow()) as { id: string };

  for (const voterId of options.voterIds ?? []) {
    await db.insertInto("queue_votes").values({ proposal_id: row.id, user_id: voterId }).execute();
  }
  return row.id;
}

/** A second authenticated request context, logged in as the E2E member. */
async function memberContext(baseURL: string): Promise<APIRequestContext> {
  const ctx = await playwrightRequest.newContext({ baseURL });
  const res = await ctx.post("/api/auth/login", {
    data: { identifier: E2E_MEMBER.username, password: E2E_MEMBER.password },
  });
  expect(res.ok()).toBeTruthy();
  return ctx;
}

test.describe.serial("group queue API", () => {
  let db: TestDb;

  test.beforeAll(() => {
    db = createDb();
  });

  test.afterAll(async () => {
    await resetQueue(db);
    await db.destroy();
  });

  test.beforeEach(async () => {
    await resetQueue(db);
  });

  test("propose creates a proposal, then dedups to a no-op", async ({ request }) => {
    const first = await request.post("/api/queue/propose", { data: { mediaId: MEDIA_A } });
    expect(first.status()).toBe(201);
    const firstBody = (await first.json()) as { data: { id: string; alreadyProposed: boolean } };
    // A fresh create reports alreadyProposed=false (the structured dedup flag the
    // UI keys on, instead of string-matching the message — slice-1 review note).
    expect(firstBody.data.alreadyProposed).toBe(false);

    const second = await request.post("/api/queue/propose", { data: { mediaId: MEDIA_A } });
    // Dedup: 200 (not 201) and the SAME proposal id returned.
    expect(second.status()).toBe(200);
    const secondBody = (await second.json()) as { data: { id: string; alreadyProposed: boolean } };
    expect(secondBody.data.id).toBe(firstBody.data.id);
    // The dedup no-op reports alreadyProposed=true.
    expect(secondBody.data.alreadyProposed).toBe(true);

    // The partial unique index held: exactly one active proposal for this media.
    const count = await db
      .selectFrom("queue_proposals")
      .select((eb) => eb.fn.countAll().as("c"))
      .where("media_id", "=", MEDIA_A)
      .where("status", "in", ["proposed", "scheduled"])
      .executeTakeFirstOrThrow();
    expect(Number(count.c)).toBe(1);
  });

  test("the first proposal on an empty queue auto-fills the scheduled slot", async ({
    request,
  }) => {
    const res = await request.post("/api/queue/propose", { data: { mediaId: MEDIA_A } });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as { data: { id: string } };

    // The fresh proposal was promoted into the (dateless) scheduled slot.
    const row = await db
      .selectFrom("queue_proposals")
      .select(["status", "scheduled_date"])
      .where("id", "=", body.data.id)
      .executeTakeFirstOrThrow();
    expect(row.status).toBe("scheduled");
    expect(row.scheduled_date).toBeNull();
  });

  test("a later proposal joins the vote list and does not become a second scheduled pick", async ({
    request,
  }) => {
    await request.post("/api/queue/propose", { data: { mediaId: MEDIA_A } }); // auto-scheduled
    const second = await request.post("/api/queue/propose", { data: { mediaId: MEDIA_B } });
    const secondId = ((await second.json()) as { data: { id: string } }).data.id;

    // Second proposal stays proposed; still exactly one scheduled pick.
    const row = await db
      .selectFrom("queue_proposals")
      .select("status")
      .where("id", "=", secondId)
      .executeTakeFirstOrThrow();
    expect(row.status).toBe("proposed");

    const scheduledCount = await db
      .selectFrom("queue_proposals")
      .select((eb) => eb.fn.countAll().as("c"))
      .where("status", "=", "scheduled")
      .where("media_id", "in", E2E_QUEUE_MEDIA_IDS)
      .executeTakeFirstOrThrow();
    expect(Number(scheduledCount.c)).toBe(1);
  });

  test("voting a list item above the scheduled pick does NOT re-promote (slot stable)", async ({
    request,
  }) => {
    // A auto-schedules; B joins the list. Pile votes on B so it outranks A.
    const a = await request.post("/api/queue/propose", { data: { mediaId: MEDIA_A } });
    const aId = ((await a.json()) as { data: { id: string } }).data.id;
    const b = await request.post("/api/queue/propose", { data: { mediaId: MEDIA_B } });
    const bId = ((await b.json()) as { data: { id: string } }).data.id;

    await request.post(`/api/queue/${bId}/vote`);

    // A is still the scheduled pick despite B now having more votes.
    const scheduled = await db
      .selectFrom("queue_proposals")
      .select(["id"])
      .where("status", "=", "scheduled")
      .where("media_id", "in", E2E_QUEUE_MEDIA_IDS)
      .executeTakeFirstOrThrow();
    expect(scheduled.id).toBe(aId);

    // B is still merely proposed.
    const bRow = await db
      .selectFrom("queue_proposals")
      .select("status")
      .where("id", "=", bId)
      .executeTakeFirstOrThrow();
    expect(bRow.status).toBe("proposed");
  });

  test("vote toggle is idempotent via the unique constraint", async ({ request }) => {
    const id = await seedProposal(db, {
      mediaId: MEDIA_A,
      status: "proposed",
      proposedAt: "2026-01-01T00:00:00Z",
    });

    // Two POSTs (votes) — second must not double-count.
    await request.post(`/api/queue/${id}/vote`);
    const voteAgain = await request.post(`/api/queue/${id}/vote`);
    const voteBody = (await voteAgain.json()) as { data: { voteCount: number; hasVoted: boolean } };
    expect(voteBody.data.voteCount).toBe(1);
    expect(voteBody.data.hasVoted).toBe(true);

    // DELETE removes it; a second DELETE is a no-op (still 0).
    await request.delete(`/api/queue/${id}/vote`);
    const unvoteAgain = await request.delete(`/api/queue/${id}/vote`);
    const unvoteBody = (await unvoteAgain.json()) as {
      data: { voteCount: number; hasVoted: boolean };
    };
    expect(unvoteBody.data.voteCount).toBe(0);
    expect(unvoteBody.data.hasVoted).toBe(false);
  });

  test("schedule sets a date on the scheduled pick and rejects non-scheduled", async ({
    request,
  }) => {
    const scheduledId = await seedProposal(db, {
      mediaId: MEDIA_A,
      status: "scheduled",
      proposedAt: "2026-01-01T00:00:00Z",
    });
    const proposedId = await seedProposal(db, {
      mediaId: MEDIA_B,
      status: "proposed",
      proposedAt: "2026-01-02T00:00:00Z",
    });

    // Set a date — and assert it persists as the SAME calendar day (no TZ
    // off-by-one from coercing the date string through a Date).
    const set = await request.patch(`/api/queue/${scheduledId}/schedule`, {
      data: { scheduledDate: "2026-07-01" },
    });
    expect(set.ok()).toBeTruthy();
    const dated = await db
      .selectFrom("queue_proposals")
      .select("scheduled_date")
      .where("id", "=", scheduledId)
      .executeTakeFirstOrThrow();
    // The stored calendar day must still be July 1, not June 30 (no TZ shift).
    // The driver returns the `date` column as a local-midnight Date; read its
    // local Y-M-D, which is the calendar day Postgres holds.
    const d = new Date(dated.scheduled_date as string);
    const ymd = `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    expect(ymd).toBe("2026-07-01");

    // Clear it back to dateless.
    const clear = await request.patch(`/api/queue/${scheduledId}/schedule`, {
      data: { scheduledDate: null },
    });
    expect(clear.ok()).toBeTruthy();
    const cleared = await db
      .selectFrom("queue_proposals")
      .select("scheduled_date")
      .where("id", "=", scheduledId)
      .executeTakeFirstOrThrow();
    expect(cleared.scheduled_date).toBeNull();

    // A non-scheduled proposal cannot be dated.
    const rejected = await request.patch(`/api/queue/${proposedId}/schedule`, {
      data: { scheduledDate: "2026-07-01" },
    });
    expect(rejected.status()).toBe(409);
  });

  test("delete removes a proposal and writes a queue.removed audit row", async ({ request }) => {
    const id = await seedProposal(db, {
      mediaId: MEDIA_A,
      status: "proposed",
      proposedAt: "2026-01-01T00:00:00Z",
    });

    const res = await request.delete(`/api/queue/${id}`);
    expect(res.ok()).toBeTruthy();

    const gone = await db
      .selectFrom("queue_proposals")
      .select("id")
      .where("id", "=", id)
      .executeTakeFirst();
    expect(gone).toBeUndefined();

    const audit = await db
      .selectFrom("audit_log")
      .select("id")
      .where("action", "=", "queue.removed")
      .where("entity_id", "=", id)
      .executeTakeFirst();
    expect(audit).not.toBeUndefined();
  });

  test("removing the scheduled pick re-fills the slot from the next proposal", async ({
    request,
  }) => {
    const scheduledId = await seedProposal(db, {
      mediaId: MEDIA_A,
      status: "scheduled",
      proposedAt: "2026-01-01T00:00:00Z",
    });
    const nextId = await seedProposal(db, {
      mediaId: MEDIA_B,
      status: "proposed",
      proposedAt: "2026-02-01T00:00:00Z",
    });

    const res = await request.delete(`/api/queue/${scheduledId}`);
    expect(res.ok()).toBeTruthy();

    // The escape hatch: the next proposal auto-promotes into the empty slot.
    const promoted = await db
      .selectFrom("queue_proposals")
      .select(["id", "scheduled_date"])
      .where("status", "=", "scheduled")
      .where("media_id", "in", E2E_QUEUE_MEDIA_IDS)
      .executeTakeFirstOrThrow();
    expect(promoted.id).toBe(nextId);
    expect(promoted.scheduled_date).toBeNull();
  });

  test("removing a proposal reclaims its orphaned media row", async ({ request }) => {
    // MEDIA_A is referenced ONLY by this proposal (no sessions, no watchlist) —
    // an import-then-propose orphan. Removing the proposal should delete it.
    const id = await seedProposal(db, {
      mediaId: MEDIA_A,
      status: "proposed",
      proposedAt: "2026-01-01T00:00:00Z",
    });

    const res = await request.delete(`/api/queue/${id}`);
    expect(res.ok()).toBeTruthy();

    const media = await db
      .selectFrom("media")
      .select("id")
      .where("id", "=", MEDIA_A)
      .executeTakeFirst();
    expect(media).toBeUndefined();

    // Audit trail for the vanished media row.
    const audit = await db
      .selectFrom("audit_log")
      .select("id")
      .where("action", "=", "media.deleted")
      .where("entity_id", "=", MEDIA_A)
      .executeTakeFirst();
    expect(audit).not.toBeUndefined();
  });

  test("removing a proposal keeps media that a watch session references", async ({ request }) => {
    const id = await seedProposal(db, {
      mediaId: MEDIA_A,
      status: "proposed",
      proposedAt: "2026-01-01T00:00:00Z",
    });
    // A logged session references MEDIA_A — deleting media would cascade-destroy
    // the session, so the orphan guard must keep the media row.
    await db
      .insertInto("watch_sessions")
      .values({ media_id: MEDIA_A, date_watched: "2026-01-02", picked_by_user_id: E2E_ADMIN.id })
      .execute();

    const res = await request.delete(`/api/queue/${id}`);
    expect(res.ok()).toBeTruthy();

    const media = await db
      .selectFrom("media")
      .select("id")
      .where("id", "=", MEDIA_A)
      .executeTakeFirst();
    expect(media).not.toBeUndefined();
  });

  test("removing a proposal downgrades watchlist entries and reclaims the media", async ({
    request,
  }) => {
    const id = await seedProposal(db, {
      mediaId: MEDIA_A,
      status: "proposed",
      proposedAt: "2026-01-01T00:00:00Z",
    });
    // Someone has MEDIA_A on their watchlist by media_id (an imported entry,
    // carrying the external fallback fields the app always writes since
    // migration 0030). Watchlist entries no longer block reclaiming orphaned
    // media — the FK is SET NULL, so the bookmark must survive the media
    // delete downgraded to external-only instead of being destroyed.
    await db
      .insertInto("watchlist")
      .values({
        media_id: MEDIA_A,
        user_id: E2E_ADMIN.id,
        status: "planning",
        tmdb_id: TMDB_A,
        ext_title: "Queue Test Media 1",
        ext_media_type: "movie",
      })
      .execute();

    const res = await request.delete(`/api/queue/${id}`);
    expect(res.ok()).toBeTruthy();

    const media = await db
      .selectFrom("media")
      .select("id")
      .where("id", "=", MEDIA_A)
      .executeTakeFirst();
    expect(media).toBeUndefined();

    const entry = await db
      .selectFrom("watchlist")
      .select(["media_id", "tmdb_id"])
      .where("user_id", "=", E2E_ADMIN.id)
      .where("tmdb_id", "=", TMDB_A)
      .executeTakeFirst();
    expect(entry).not.toBeUndefined();
    expect(entry?.media_id).toBeNull();
  });

  test("deleting media that is the scheduled pick re-fills the slot", async ({ request }) => {
    // MEDIA_A scheduled, MEDIA_B the next proposal. Admin deletes MEDIA_A out
    // from under the queue — the FK cascade removes A's proposal; the slot must
    // re-fill from B (the cascade alone would leave it empty).
    await seedProposal(db, {
      mediaId: MEDIA_A,
      status: "scheduled",
      proposedAt: "2026-01-01T00:00:00Z",
    });
    const nextId = await seedProposal(db, {
      mediaId: MEDIA_B,
      status: "proposed",
      proposedAt: "2026-02-01T00:00:00Z",
    });

    const res = await request.delete(`/api/media/${MEDIA_A}`);
    expect(res.ok()).toBeTruthy();

    const scheduled = await db
      .selectFrom("queue_proposals")
      .select("id")
      .where("status", "=", "scheduled")
      .where("media_id", "in", E2E_QUEUE_MEDIA_IDS)
      .executeTakeFirstOrThrow();
    expect(scheduled.id).toBe(nextId);
  });

  test("logging the scheduled pick advances the queue to the top-voted proposal", async ({
    request,
  }) => {
    // A is scheduled; B (2 votes) and C (2 votes, but older) are proposed.
    const scheduledId = await seedProposal(db, {
      mediaId: MEDIA_A,
      status: "scheduled",
      proposedAt: "2026-01-01T00:00:00Z",
    });
    const olderTie = await seedProposal(db, {
      mediaId: MEDIA_C,
      status: "proposed",
      proposedAt: "2026-02-01T00:00:00Z",
      voterIds: [E2E_ADMIN.id, E2E_MEMBER.id],
    });
    await seedProposal(db, {
      mediaId: MEDIA_B,
      status: "proposed",
      proposedAt: "2026-03-01T00:00:00Z",
      voterIds: [E2E_ADMIN.id, E2E_MEMBER.id],
    });

    // Log a watch of the scheduled media -> advance hook runs in the transaction.
    const res = await request.post("/api/sessions", {
      data: { mediaId: MEDIA_A, attendeeIds: [E2E_ADMIN.id] },
    });
    expect(res.status()).toBe(201);

    // Old scheduled pick is now watched and linked to the session.
    const watched = await db
      .selectFrom("queue_proposals")
      .select(["status", "watched_session_id"])
      .where("id", "=", scheduledId)
      .executeTakeFirstOrThrow();
    expect(watched.status).toBe("watched");
    expect(watched.watched_session_id).not.toBeNull();

    // Tie on votes (2 each) broken by oldest proposal -> C promotes, not B.
    const promoted = await db
      .selectFrom("queue_proposals")
      .select(["id", "status", "scheduled_date", "won_votes", "runner_up_votes"])
      .where("status", "=", "scheduled")
      .executeTakeFirstOrThrow();
    expect(promoted.id).toBe(olderTie);
    expect(promoted.scheduled_date).toBeNull(); // promoted dateless
    // Promotion tally frozen: C won with 2, runner-up B also had 2.
    expect(promoted.won_votes).toBe(2);
    expect(promoted.runner_up_votes).toBe(2);

    // The advance was audit-logged.
    const audit = await db
      .selectFrom("audit_log")
      .select("id")
      .where("action", "=", "queue.advanced")
      .where("entity_id", "=", scheduledId)
      .executeTakeFirst();
    expect(audit).not.toBeUndefined();
  });

  test("logging an off-queue title does not disturb the queue", async ({ request }) => {
    const scheduledId = await seedProposal(db, {
      mediaId: MEDIA_A,
      status: "scheduled",
      proposedAt: "2026-01-01T00:00:00Z",
    });

    // Log MEDIA_B, which is NOT the scheduled pick.
    const res = await request.post("/api/sessions", {
      data: { mediaId: MEDIA_B, attendeeIds: [E2E_ADMIN.id] },
    });
    expect(res.status()).toBe(201);

    // Scheduled pick is untouched.
    const stillScheduled = await db
      .selectFrom("queue_proposals")
      .select("status")
      .where("id", "=", scheduledId)
      .executeTakeFirstOrThrow();
    expect(stillScheduled.status).toBe("scheduled");
  });

  test("logging a vote-list proposal closes it without touching the scheduled slot", async ({
    request,
  }) => {
    // A is scheduled; B sits in the vote list.
    const scheduledId = await seedProposal(db, {
      mediaId: MEDIA_A,
      status: "scheduled",
      proposedAt: "2026-01-01T00:00:00Z",
    });
    const voteListId = await seedProposal(db, {
      mediaId: MEDIA_B,
      status: "proposed",
      proposedAt: "2026-02-01T00:00:00Z",
      voterIds: [E2E_ADMIN.id],
    });

    // Log a watch of B (NOT the scheduled pick), undated = current watch.
    const res = await request.post("/api/sessions", {
      data: { mediaId: MEDIA_B, attendeeIds: [E2E_ADMIN.id] },
    });
    expect(res.status()).toBe(201);

    // B is closed: watched and linked to the session.
    const closed = await db
      .selectFrom("queue_proposals")
      .select(["status", "watched_session_id"])
      .where("id", "=", voteListId)
      .executeTakeFirstOrThrow();
    expect(closed.status).toBe("watched");
    expect(closed.watched_session_id).not.toBeNull();

    // The scheduled slot's occupant is untouched (no promotion ran).
    const stillScheduled = await db
      .selectFrom("queue_proposals")
      .select("status")
      .where("id", "=", scheduledId)
      .executeTakeFirstOrThrow();
    expect(stillScheduled.status).toBe("scheduled");

    // The close was audit-logged as a non-scheduled closure.
    const audit = await db
      .selectFrom("audit_log")
      .select("metadata")
      .where("action", "=", "queue.advanced")
      .where("entity_id", "=", voteListId)
      .executeTakeFirstOrThrow();
    expect((audit.metadata as { wasScheduled: boolean }).wasScheduled).toBe(false);
  });

  test("a historical backfill leaves the queued proposal alone", async ({ request }) => {
    // B proposed on Feb 1; someone logs a watch from mid-January — a backfill
    // of a watch that predates the proposal, not the group watch it's queued for.
    const voteListId = await seedProposal(db, {
      mediaId: MEDIA_B,
      status: "proposed",
      proposedAt: "2026-02-01T00:00:00Z",
      voterIds: [E2E_ADMIN.id],
    });

    const res = await request.post("/api/sessions", {
      data: { mediaId: MEDIA_B, attendeeIds: [E2E_ADMIN.id], dateWatched: "2026-01-15" },
    });
    expect(res.status()).toBe(201);

    // The proposal survives — the group still plans to watch it.
    const untouched = await db
      .selectFrom("queue_proposals")
      .select(["status", "watched_session_id"])
      .where("id", "=", voteListId)
      .executeTakeFirstOrThrow();
    expect(untouched.status).toBe("proposed");
    expect(untouched.watched_session_id).toBeNull();
  });

  test("advancing with no remaining proposals empties the slot", async ({ request }) => {
    const scheduledId = await seedProposal(db, {
      mediaId: MEDIA_A,
      status: "scheduled",
      proposedAt: "2026-01-01T00:00:00Z",
    });

    const res = await request.post("/api/sessions", {
      data: { mediaId: MEDIA_A, attendeeIds: [E2E_ADMIN.id] },
    });
    expect(res.status()).toBe(201);

    // Old pick watched; nothing promoted -> no scheduled row remains.
    const watched = await db
      .selectFrom("queue_proposals")
      .select("status")
      .where("id", "=", scheduledId)
      .executeTakeFirstOrThrow();
    expect(watched.status).toBe("watched");

    const scheduledNow = await db
      .selectFrom("queue_proposals")
      .select("id")
      .where("status", "=", "scheduled")
      .where("media_id", "in", E2E_QUEUE_MEDIA_IDS)
      .executeTakeFirst();
    expect(scheduledNow).toBeUndefined();
  });

  test("concurrent logs of the scheduled pick do not lose a watch session", async ({
    request,
    baseURL,
  }) => {
    // A scheduled, B proposed (the next promotion). Two members log A at once.
    await seedProposal(db, {
      mediaId: MEDIA_A,
      status: "scheduled",
      proposedAt: "2026-01-01T00:00:00Z",
    });
    await seedProposal(db, {
      mediaId: MEDIA_B,
      status: "proposed",
      proposedAt: "2026-02-01T00:00:00Z",
      voterIds: [E2E_ADMIN.id],
    });

    const member = await memberContext(baseURL ?? "http://localhost:3001");
    try {
      // Fire both session logs concurrently. Without FOR UPDATE on the scheduled
      // read, the second collides with the single-scheduled unique index and its
      // session insert rolls back. With the fix, both logs succeed.
      const [adminRes, memberRes] = await Promise.all([
        request.post("/api/sessions", {
          data: { mediaId: MEDIA_A, attendeeIds: [E2E_ADMIN.id] },
        }),
        member.post("/api/sessions", {
          data: { mediaId: MEDIA_A, attendeeIds: [E2E_MEMBER.id] },
        }),
      ]);

      expect(adminRes.status()).toBe(201);
      expect(memberRes.status()).toBe(201);

      // Both watch sessions persisted (the core writes were not lost).
      const sessionCount = await db
        .selectFrom("watch_sessions")
        .select((eb) => eb.fn.countAll().as("c"))
        .where("media_id", "=", MEDIA_A)
        .executeTakeFirstOrThrow();
      expect(Number(sessionCount.c)).toBe(2);

      // Exactly one scheduled pick remains (the invariant held throughout).
      const scheduledCount = await db
        .selectFrom("queue_proposals")
        .select((eb) => eb.fn.countAll().as("c"))
        .where("status", "=", "scheduled")
        .where("media_id", "in", E2E_QUEUE_MEDIA_IDS)
        .executeTakeFirstOrThrow();
      expect(Number(scheduledCount.c)).toBe(1);
    } finally {
      await member.dispose();
    }
  });

  test("importing a title that already exists returns the existing media id (not a 409)", async ({
    request,
  }) => {
    // The watchlist import-then-propose path has no search step to pre-resolve an
    // already-imported title to its media id (unlike the import dialog's
    // existingMediaMap). So a duplicate import must hand back the existing row's
    // id — a usable id to propose — instead of the bare 409 it used to return.
    // The duplicate short-circuits before the external API, so seeding a media
    // row with a known tmdb_id is enough; no TMDB call happens.
    const TMDB_ID = 424_242;
    await db.updateTable("media").set({ tmdb_id: TMDB_ID }).where("id", "=", MEDIA_A).execute();

    const res = await request.post("/api/media/import", {
      data: { tmdbId: TMDB_ID, type: "movie" },
    });

    // 200 (not 201, not 409) and the SAME existing media id, flagged as a dup.
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: { id: string; alreadyExisted: boolean } };
    expect(body.data.id).toBe(MEDIA_A);
    expect(body.data.alreadyExisted).toBe(true);
  });

  test("concurrent proposes into an empty queue both succeed with one scheduled pick", async ({
    request,
    baseURL,
  }) => {
    // Two members propose different titles into a fresh (empty) queue at once.
    // Both fills race for the empty slot; the advisory lock serializes them so
    // neither request 500s and exactly one title ends up scheduled.
    const member = await memberContext(baseURL ?? "http://localhost:3001");
    try {
      const [adminRes, memberRes] = await Promise.all([
        request.post("/api/queue/propose", { data: { mediaId: MEDIA_A } }),
        member.post("/api/queue/propose", { data: { mediaId: MEDIA_B } }),
      ]);

      // Neither propose failed (no 23505-driven 500 on the losing fill).
      expect(adminRes.status()).toBe(201);
      expect(memberRes.status()).toBe(201);

      // Both proposals exist; exactly one is scheduled, the other proposed.
      const rows = await db
        .selectFrom("queue_proposals")
        .select(["status"])
        .where("media_id", "in", E2E_QUEUE_MEDIA_IDS)
        .execute();
      expect(rows).toHaveLength(2);
      expect(rows.filter((r) => r.status === "scheduled")).toHaveLength(1);
      expect(rows.filter((r) => r.status === "proposed")).toHaveLength(1);
    } finally {
      await member.dispose();
    }
  });
});

test.describe("group queue real-time (slice 3)", () => {
  test("the issued Ably token grants subscribe on the group:queue channel", async ({ request }) => {
    // Clients subscribe to the live queue channel with the scoped token from
    // /api/ably/auth — without this grant the browser can't receive queue events.
    const res = await request.get("/api/ably/auth");
    expect(res.ok()).toBeTruthy();

    const body = (await res.json()) as { data: { capability: string } };
    // Ably serializes `capability` as a JSON string of { channel: [ops] }.
    const capability = JSON.parse(body.data.capability) as Record<string, string[]>;

    expect(capability["group:queue"]).toContain("subscribe");
  });
});

/**
 * FeaturedBand picker/attendee enrichment (slice 6 part B).
 *
 * The featured endpoint reads picker + attendees from the queue's canonical
 * session lineage: a `watched` proposal's `watched_session_id` names the session
 * whose `picked_by_user_id` and `session_attendees` surface on the card. This
 * exercises that SQL wiring (the pure tie-break is unit-tested separately).
 */
test.describe.serial("featured band queue lineage (slice 6)", () => {
  let db: TestDb;

  test.beforeAll(() => {
    db = createDb();
  });

  test.afterAll(async () => {
    await resetQueue(db);
    await db.destroy();
  });

  test.beforeEach(async () => {
    await resetQueue(db);
  });

  test("featured response carries the picker + attendees from the canonical watched session", async ({
    request,
  }) => {
    // Seed MEDIA_A as a rated, queue-watched title: a session picked by the
    // member and attended by both, two ratings (the featured query needs >=2),
    // and a watched proposal linking that session as canonical.
    const session = (await db
      .insertInto("watch_sessions")
      .values({
        media_id: MEDIA_A,
        date_watched: "2026-04-01",
        picked_by_user_id: E2E_MEMBER.id,
        created_by_user_id: E2E_ADMIN.id,
      })
      .returning("id")
      .executeTakeFirstOrThrow()) as { id: string };

    await db
      .insertInto("session_attendees")
      .values([
        { session_id: session.id, user_id: E2E_ADMIN.id },
        { session_id: session.id, user_id: E2E_MEMBER.id },
      ])
      .execute();

    await db
      .insertInto("ratings")
      .values([
        { session_id: session.id, user_id: E2E_ADMIN.id, score: 10 },
        { session_id: session.id, user_id: E2E_MEMBER.id, score: 10 },
      ])
      .execute();

    // A watched proposal links the session as the canonical pick.
    await db
      .insertInto("queue_proposals")
      .values({
        media_id: MEDIA_A,
        proposed_by: E2E_MEMBER.id,
        status: "watched",
        watched_session_id: session.id,
        proposed_at: "2026-03-01T00:00:00Z",
      })
      .execute();

    const res = await request.get("/api/stats/featured");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      data: {
        main: {
          id: string;
          picker: { username: string } | null;
          attendees: { username: string }[];
        } | null;
        supporting: {
          id: string;
          picker: { username: string } | null;
          attendees: { username: string }[];
        }[];
      };
    };

    // Find our seeded title wherever it ranked (main or supporting).
    const all = [body.data.main, ...body.data.supporting].filter((m) => m !== null);
    const seeded = all.find((m) => m.id === MEDIA_A);
    expect(seeded).toBeDefined();

    // Picker is the session's picked_by_user_id (the member), not the proposer
    // by coincidence — both are the member here, but the source is the session.
    expect(seeded?.picker?.username).toBe(E2E_MEMBER.username);

    // Both attendees come through.
    const attendeeUsernames = (seeded?.attendees ?? []).map((a) => a.username).toSorted(byName);
    expect(attendeeUsernames).toEqual([E2E_ADMIN.username, E2E_MEMBER.username].toSorted(byName));
  });

  test("a featured title with no watched proposal shows no picker/attendees", async ({
    request,
  }) => {
    // Same rated session, but NO watched queue proposal — the off-queue / history
    // case. The card must degrade: null picker, empty attendees.
    const session = (await db
      .insertInto("watch_sessions")
      .values({
        media_id: MEDIA_B,
        date_watched: "2026-04-02",
        picked_by_user_id: E2E_ADMIN.id,
        created_by_user_id: E2E_ADMIN.id,
      })
      .returning("id")
      .executeTakeFirstOrThrow()) as { id: string };

    await db
      .insertInto("session_attendees")
      .values([{ session_id: session.id, user_id: E2E_ADMIN.id }])
      .execute();

    await db
      .insertInto("ratings")
      .values([
        { session_id: session.id, user_id: E2E_ADMIN.id, score: 9 },
        { session_id: session.id, user_id: E2E_MEMBER.id, score: 9 },
      ])
      .execute();

    const res = await request.get("/api/stats/featured");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      data: {
        main: { id: string; picker: unknown; attendees: unknown[] } | null;
        supporting: { id: string; picker: unknown; attendees: unknown[] }[];
      };
    };

    const all = [body.data.main, ...body.data.supporting].filter((m) => m !== null);
    const seeded = all.find((m) => m.id === MEDIA_B);
    expect(seeded).toBeDefined();
    expect(seeded?.picker).toBeNull();
    expect(seeded?.attendees).toEqual([]);
  });
});
