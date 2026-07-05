# CDb Group Queue — Scheduling & Voting (Phase 12, slice 1)

**Status:** Approved design (design-only session; implementation deferred to follow-up sessions)
**Date:** 2026-06-20 **Owner:** dev

Parent:
[Design System Rollout — Phase 12](./2026-05-22-design-system-rollout-design.md#phase-12--scheduling--queue-new-product-feature-not-a-visual-phase)

---

## 1. Context & Goal

Phase 12 of the design system rollout is a real product feature, not a visual phase. The kit already
specs its UI (`.cdb-queue-*`, the import-dialog Propose button); this document designs the
underlying feature so that UI can be wired to real data.

**The feature in one sentence:** a group queue where any member proposes a title, everyone upvotes,
the top pick auto-promotes into a "scheduled" slot, and logging that pick as watched advances the
queue, all broadcast live over Ably.

This design covers the **group queue** (the centerpiece). Two related kit features, the **timeline
view** in Database and the **FeaturedBand picker/attendees enrichment**, are separate slices tracked
in the parent spec. The FeaturedBand enrichment is explicitly unblocked by this feature (it reads
the proposer/session lineage the queue records).

### Why the queue is the unblocker for the FeaturedBand enrichment

The data the enrichment needs (`picked_by_user_id`, `session_attendees`) already exists, but
`/api/stats/featured` aggregates per-media rating averages only and never joins to sessions, and a
featured title can have several sessions (the "which session?" problem). The queue records a
canonical proposer/session lineage per pick, which resolves that ambiguity and makes the enrichment
cheap. See parent spec lines 714-723.

---

## 2. Decisions Log

Captured from brainstorming. Pin these so implementation sessions don't relitigate.

| Decision                                  | Choice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema shape                              | **Dedicated tables** (`queue_proposals` + `queue_votes`)                                                                                                                                                                                                                                                                                                                                                                                                                                  | Isolates the feature from stats/timeline/featured aggregate queries; no blast radius on `watch_sessions`. Extending `watch_sessions` with a status was rejected: disjoint columns, a permanent `WHERE status='watched'` correctness tax on every existing aggregate, and votes need their own table regardless.                                                                                                                                                           |
| Voting model                              | **Unlimited upvotes**, one per proposal per person, ranked by total                                                                                                                                                                                                                                                                                                                                                                                                                       | Matches the kit's `toggleVote`; hard to game in a small friend group; no "spend wisely" friction.                                                                                                                                                                                                                                                                                                                                                                         |
| Vote count storage                        | **Derived** (`COUNT(queue_votes)`), never a stored counter                                                                                                                                                                                                                                                                                                                                                                                                                                | Free over a tiny table; makes counter drift impossible. Revisit only under measured read pressure.                                                                                                                                                                                                                                                                                                                                                                        |
| Promotion                                 | **Auto-promote** top-voted into a **dateless** scheduled slot when the current pick is logged watched                                                                                                                                                                                                                                                                                                                                                                                     | Keeps the slot a live anchor (never empty while proposals exist); date is a deliberate human act, not guessed (movie nights land on irregular days).                                                                                                                                                                                                                                                                                                                      |
| Slot bootstrap / fill (slice-2 follow-up) | **Auto-fill the scheduled slot from the top proposal whenever it is empty** (votes DESC, oldest tie-break; fills even at 0 votes, so the very first proposal schedules immediately). **Stable once filled** — the scheduled pick never changes because the vote list re-ranks; only logging it watched empties the slot, which then immediately re-fills. Trigger: an `ensureScheduledFilled(trx)` helper called from the propose + vote writes (and shared with the watch-advance path). | Closes a real gap: promotion originally fired _only_ on watch-advance, so a brand-new queue could never schedule its first pick (chicken-and-egg) — every queue sat permanently unscheduled. This delivers the Promotion row's stated "never empty while proposals exist" promise the original design only half-implemented. Stable-once-filled avoids churn (the slot jumping as votes shift) and matches the tie-break row's "runner-up stays #1 for next time" intent. |
| Tie-break                                 | **Oldest proposal** (`proposed_at` ASC) wins                                                                                                                                                                                                                                                                                                                                                                                                                                              | Deterministic, rewards patience, no UI needed. Runner-up stays #1 for next time.                                                                                                                                                                                                                                                                                                                                                                                          |
| Permissions                               | **Any member, full trust** (propose / vote / schedule / change date / remove)                                                                                                                                                                                                                                                                                                                                                                                                             | Matches the friend-group ethos and the kit (no gating shown). Destructive actions audit-logged.                                                                                                                                                                                                                                                                                                                                                                           |
| Override / force-push                     | **None.** Votes + automation only                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Not in the kit; a mod-only force-push would contradict full-trust (members can already schedule/remove). Escape hatch already exists: remove the scheduled proposal -> next promotes, or vote a title up.                                                                                                                                                                                                                                                                 |
| Real-time                                 | **Live via Ably** (`group:queue` channel) + SWR optimistic on the actor's own vote                                                                                                                                                                                                                                                                                                                                                                                                        | Picking is a shared-moment activity; live pays off. Reuses the existing `presence:group`-style group-broadcast pattern.                                                                                                                                                                                                                                                                                                                                                   |
| Advance trigger                           | **Approach A** — hook `advanceQueueOnWatch(trx, mediaId)` into the existing `POST /api/sessions` transaction                                                                                                                                                                                                                                                                                                                                                                              | Single source of truth for "this is done"; atomic with the log; mirrors the existing watchlist auto-removal in that route.                                                                                                                                                                                                                                                                                                                                                |
| Watch-close scoping (revised 2026-07-04)  | **Any current watch closes the media's active proposal** (vote-list rows included), marking it `watched` + linking the session; promotion still fires only when the closed row was the scheduled pick. Historical backfills (session dated ≥2 days before the proposal; 1-day grace for local-date-vs-UTC-instant skew) and off-queue media are no-ops.                                                                                                                                   | The original scheduled-only rule left watched titles sitting in the vote list and later **promoted already-watched titles** into the slot (diagnosed live in dev, 2026-07-04). The one behavior lost — a member logging a queued title out from under the group's plan — is niche and recoverable (re-propose; the close is audit-logged and broadcast live).                                                                                                             |
| Advance scoping                           | **Creation only.** Do NOT unwind the advance on session edit/delete                                                                                                                                                                                                                                                                                                                                                                                                                       | Reversing a promotion adds real branching complexity for a near-never event. Accidental log-then-delete leaves the queue one step ahead, fully recoverable by re-proposing; audit-logged so it's not mysterious.                                                                                                                                                                                                                                                          |
| Duplicate proposals                       | **One active entry per media** (DB partial unique index). Re-proposing an active title surfaces/votes the existing one; re-proposing a watched title is allowed (re-watch).                                                                                                                                                                                                                                                                                                               | Keeps the list clean, prevents vote-splitting.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Empty state                               | **Dashboard mirrors the sidebar CTA** ("Nothing scheduled yet, propose something")                                                                                                                                                                                                                                                                                                                                                                                                        | Section stays visible as an invitation rather than vanishing.                                                                                                                                                                                                                                                                                                                                                                                                             |
| Dateless copy                             | **"NO DATE YET"** on both the sidebar Up Next card and the dashboard scheduled card                                                                                                                                                                                                                                                                                                                                                                                                       | Matched copy (differing wording reads as a bug). Preserves the eyebrow structure so layout doesn't shift between dated and dateless.                                                                                                                                                                                                                                                                                                                                      |
| Contextual schedule button                | **"Set date"** when `scheduled_date` is null, **"Change date"** when a date exists                                                                                                                                                                                                                                                                                                                                                                                                        | Makes the dateless state advertise its own fix.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Watched proposals                         | **Persist as history** (status `'watched'`, linked to the `watch_sessions` row)                                                                                                                                                                                                                                                                                                                                                                                                           | Feeds the FeaturedBand enrichment ("Picked by", "Won the vote") and the "Won the vote, X to Y" record. Trivial row cost.                                                                                                                                                                                                                                                                                                                                                  |
| Test strategy (slice 1)                   | **Extract pure logic + Vitest-unit it; E2E the SQL/route wiring.** NOT a Vitest+real-DB harness                                                                                                                                                                                                                                                                                                                                                                                           | The repo has no Vitest-against-real-DB infra (every DB test mocks the client); building one is bigger/riskier than the feature. Matches the existing `predictions/signals` pattern. Full rationale in §8.                                                                                                                                                                                                                                                                 |

---

## 3. Surfaces in scope

Three built in full (across slices), one deferred:

- **Dashboard queue section** (`.cdb-queue-*`) — the core surface. Full.
- **Import-dialog Propose button** (`.cdb-imp-proposed` + Propose) — primary entry point, built
  first among UI. Full.
- **Sidebar Up Next integration** — the queue becomes the top source in the Up Next priority order.
  Full. (The parent spec's Phase 1 fallback explicitly waits for this.)
- **Watchlist-item Propose affordance** — lighter "Propose to group" on personal watchlist items.
  **Deferred follow-up slice**, described not built (decisions log + parent spec).

---

## 4. Data Model

New Kysely migration `0028-queue-proposals-votes.ts` (next after `0027-media-top-cast.ts`).

### `queue_proposals`

| Column               | Type                                                               | Notes                                                             |
| -------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `id`                 | uuid pk                                                            |                                                                   |
| `media_id`           | uuid -> `media(id)` ON DELETE CASCADE                              |                                                                   |
| `proposed_by`        | uuid -> `users(id)` ON DELETE SET NULL                             | proposer; SET NULL keeps the proposal if the user is deleted      |
| `status`             | text `'proposed' \| 'scheduled' \| 'watched'` default `'proposed'` | drives the lifecycle                                              |
| `scheduled_date`     | date null                                                          | set/changed by a member; `null` = "scheduled, no date yet"        |
| `scheduled_at`       | timestamptz null                                                   | when promoted into the slot (ordering/history)                    |
| `watched_session_id` | uuid null -> `watch_sessions(id)` ON DELETE SET NULL               | links a watched proposal to its real session (Approach A)         |
| `proposed_at`        | timestamptz default now()                                          | tie-break key                                                     |
| `won_votes`          | integer null                                                       | frozen at promotion: the pick's winning tally (migration 0029)    |
| `runner_up_votes`    | integer null                                                       | frozen at promotion: the runner-up's tally, 0 if unopposed (0029) |
| `created_at`         | timestamptz default now()                                          | `TimestampColumns`                                                |
| `updated_at`         | timestamptz default now()                                          | `TimestampColumns`                                                |

> **`won_votes` / `runner_up_votes` (added 2026-06-20, slice 2 — migration 0029).** The
> brainstorming overlooked where the dashboard's "Won the vote, X to Y" numbers come from. They
> can't be a live `COUNT`: both the scheduled pick **and** the runner-up stay votable after
> promotion (the vote route has no status guard, by design), so a live count drifts away from "the
> race this pick actually won". So `advanceQueueOnWatch` freezes both tallies onto the promoted row
> at promotion time via the pure `capturePromotionTally(rankedProposals)` helper. Nullable: only set
> on promotion. A separate migration (0029) rather than editing 0028 because the test/dev branches
> had already applied 0028 — editing in place would cause schema drift (Kysely won't re-run an
> already-applied migration). The scheduled pick remaining votable is intentional (matches the
> permissive API); the dashboard simply renders no vote control on the scheduled card (kit-matched),
> so in practice its live count doesn't move.

**Partial unique indexes (DB-enforced invariants):**

- One active entry per media: `UNIQUE (media_id) WHERE status IN ('proposed','scheduled')`
- At most one scheduled pick: `UNIQUE (status) WHERE status = 'scheduled'`

Both are enforced at the database level so they hold under concurrent requests with no app-level
locking. Watched rows are unconstrained, so a title can be re-proposed for a re-watch.

### `queue_votes`

| Column        | Type                                            | Notes                       |
| ------------- | ----------------------------------------------- | --------------------------- |
| `id`          | uuid pk                                         |                             |
| `proposal_id` | uuid -> `queue_proposals(id)` ON DELETE CASCADE | votes die with the proposal |
| `user_id`     | uuid -> `users(id)` ON DELETE CASCADE           |                             |
| `created_at`  | timestamptz default now()                       |                             |

**Constraint:** `UNIQUE (proposal_id, user_id)` — one vote per person per proposal. Vote count is
`COUNT(*)` over this table, never a stored column.

### Isolation guarantee

These tables are **never** joined into stats / timeline / featured aggregate queries.
`watch_sessions` gains no new columns. Nothing in the completed visual rollout (Phases 0-11)
regresses.

### Kysely types

Add to `src/lib/db/types.ts`: `QueueProposalsTable` / `QueueVotesTable` interfaces (+
`Selectable`/`Insertable`/`Updateable` aliases), register both in the `Database` interface. `status`
typed as a string union; `score`-style `ColumnType` not needed here.

---

## 5. API Surface

All under `src/app/api/queue/`. Standard `{ data, error, message }` response shape
(`src/lib/api/response.ts`), Zod-validated input (`src/lib/validations/`), `requireAuth()`.

| Route                      | Method          | Behavior                                                                                                                                                                                                                                                                                                                                     |
| -------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/queue`               | `GET`           | Returns `{ scheduled, proposals }`. `scheduled`: the scheduled pick (proposer, media, `scheduledDate`, live `voteCount`, and the frozen `wonVotes` / `runnerUpVotes` promotion tally) or `null`. `proposals`: ranked list (votes DESC, then `proposed_at` ASC), each with media, proposer, `voteCount`, and `hasVoted` for the current user. |
| `/api/queue/propose`       | `POST`          | Body `{ mediaId }`. Creates a `proposed` row. If an active proposal for that media exists, **no-op that returns the existing one** (surfaced to the UI as already-proposed). Audit-logged (`queue.proposed`).                                                                                                                                |
| `/api/queue/[id]/vote`     | `POST`/`DELETE` | Toggle the current user's vote (insert/delete the `queue_votes` row). Idempotent via the unique constraint.                                                                                                                                                                                                                                  |
| `/api/queue/[id]/schedule` | `PATCH`         | Body `{ scheduledDate }`. Sets/changes the date on the scheduled pick ("Set date" / "Change date").                                                                                                                                                                                                                                          |
| `/api/queue/[id]`          | `DELETE`        | Removes a proposal (any member). Audit-logged (`queue.removed`).                                                                                                                                                                                                                                                                             |

### The advance-on-watch hook (Approach A)

> **Revised 2026-07-04 (close-on-any-log).** The original rule — only a watch of the _scheduled_
> pick touched the queue — left watched titles rotting in the vote list (logging a vote-list
> proposal did nothing), and the queue would later _promote an already-watched title_ into the slot.
> Diagnosed live in the dev DB. New rule below: any current watch closes the media's active
> proposal; only closing the scheduled pick also promotes. Pure decision: `decideWatchClose` +
> `isHistoricalBackfill` in `ranking.ts` (replaced `decideAdvance`).

Helper `advanceQueueOnWatch(trx, { mediaId, sessionId, dateWatched })` in
`src/lib/queue/advance.ts`, called **inside the existing `POST /api/sessions` transaction**,
adjacent to the watchlist auto-removal:

1. Find the media's single **active** proposal (`proposed` or `scheduled`; the active-per-media
   unique index guarantees at most one), locked `FOR UPDATE`.
2. **Backfill guard:** if the session is dated two or more calendar days before `proposed_at`, the
   helper is a no-op — a backfilled historical watch must not kill a title the group still plans to
   watch. (One day of grace: `date_watched` is a member-local calendar day while `proposed_at` is a
   UTC instant, so a same-evening watch can sit one day "before" the proposal.) Undated sessions
   count as current.
3. Close the proposal: `status='watched'`, `watched_session_id = newSession.id`.
4. Only if the closed row was the **scheduled pick**, promote the next pick: top proposal by
   `COUNT(votes) DESC, proposed_at ASC` -> `status='scheduled'`, `scheduled_at=now()`,
   `scheduled_date=null` (dateless). If no proposals remain, the slot is empty (drives the empty
   state). Closing a vote-list row leaves the slot's occupant untouched.
5. If the media has no active proposal, the helper is a **no-op** (logging an off-queue watch
   doesn't disturb the queue).

Because it runs in the transaction, the close is atomic with the log: the log commits and the queue
advances, or both roll back. The close is audit-logged (`queue.advanced` with the watched proposal
ID, `wasScheduled`, and any newly-scheduled proposal ID) so an unexpected change has a trail.
`promoteTopProposal`'s UPDATE carries a `status='proposed'` predicate so a concurrent log that
closes the about-to-be-promoted proposal (cross-media race) results in an empty slot rather than
re-scheduling a watched row.

**Not unwound** on session edit/delete (decisions log). The proposal stays `watched`; recovery is to
re-propose, which works because watched rows don't hold the active-unique index.

### Slot auto-fill helper (slice-2 follow-up)

New helper `ensureScheduledFilled(trx)` in `src/lib/queue/ensure-scheduled.ts`, enforcing the
invariant _"if the scheduled slot is empty and a proposal exists, the top proposal occupies it."_

1. If a `scheduled` proposal already exists -> **no-op** (the slot is stable; we never re-promote
   over an occupied slot just because the vote ranking shifted).
2. Otherwise pick the top `proposed` row (`COUNT(votes) DESC, proposed_at ASC`; promotes even at 0
   votes) and set `status='scheduled'`, `scheduled_at=now()`, `scheduled_date=null`. Capture the
   `won_votes` / `runner_up_votes` tally, same as the watch-advance promotion.
3. If no `proposed` rows exist -> no-op (genuinely empty queue).

Called inside a transaction at the end of `POST /api/queue/propose` and the vote toggle
(`POST`/`DELETE /api/queue/[id]/vote`). The `single-scheduled` partial unique index makes concurrent
fills safe (a losing race hits 23505 and is swallowed / treated as already-filled). The
watch-advance path's own promotion is the same operation; `advanceQueueOnWatch` may delegate its
promote step to this helper. Audit-logged as `queue.advanced` when it promotes.

### Audit actions

`audit_log.action` is `varchar(50)` (no migration needed) but is typed as the closed `AuditAction`
union in `src/lib/db/types.ts`. Slice 1 must extend that union with `queue.proposed`,
`queue.removed`, and `queue.advanced`, or `logAudit` calls will fail typecheck.

---

## 6. Real-time (Ably)

The queue is a **group-wide broadcast**, matching the existing `presence:group` pattern (not
per-user `user:{id}` or per-game `game:{id}`).

- **Channel:** `group:queue`. Everyone subscribes; the server publishes. Clients are subscribe-only
  (the API key never reaches the browser; all writes go through the API).
- **Token capability** (`createTokenRequest` in `src/lib/notifications/ably.ts`): add
  `"group:queue": ["subscribe"]` alongside the existing `presence:group` and `user:{id}` grants.
- **Publish helpers** (`src/lib/queue/realtime.ts`, or extend `ably.ts`):
  `publishToQueue(event, data)` (fire-and-forget, like `publishToUser`) and
  `publishToQueueAsync(event, data)` (awaited, like games' `publishToGameAsync`).

### Events

| Event             | When                 | Payload                                | Delivery        |
| ----------------- | -------------------- | -------------------------------------- | --------------- |
| `queue:proposed`  | new proposal created | the new proposal (id, media, proposer) | fire-and-forget |
| `queue:voted`     | vote toggled         | `{ proposalId, voteCount }`            | fire-and-forget |
| `queue:advanced`  | watched -> promote   | `{ watchedId, scheduled }` (or `null`) | **awaited**     |
| `queue:scheduled` | date set/changed     | `{ proposalId, scheduledDate }`        | fire-and-forget |
| `queue:removed`   | proposal deleted     | `{ proposalId }`                       | fire-and-forget |

`queue:advanced` is awaited because a dropped advance leaves everyone on a stale scheduled pick
(high stakes), and serverless functions can terminate before a fire-and-forget publish lands. A
dropped vote re-syncs on next load (low stakes).

### Client hook `useQueue()` (`src/hooks/use-queue.ts`)

- SWR fetches `/api/queue` (canonical state, single source of ranking/tie-break truth).
- Subscribes to `group:queue` via the existing `AblyProvider`. On any event it **revalidates** the
  SWR key (`mutate`) rather than patching cache from the payload, so ranking/tie-break logic lives
  only in the GET. Payloads are "something changed, refetch" triggers.
- **Exception:** the actor's own vote gets an **optimistic** SWR update (instant thumbs-up flip);
  the broadcast then reconciles.

---

## 7. UI Surfaces

No new editorial primitives (the queue is utility chrome, not an editorial surface). Reuses poster
cards, `MediaTypeBadge`, avatars, `cdb-eyebrow` / `cdb-btn` token classes.

### 7a. Dashboard queue section

`src/app/(main)/home/_components/up-next-queue.tsx`, driven by `useQueue()`. Placed at the top of
the dashboard under the editorial header (kit position). Two-column grid:

- **Scheduled card (left):** poster + "Locked in" badge; eyebrow `SCHEDULED · {date | NO DATE YET}`;
  title; media-type badge + "Proposed by {name}"; "Won the vote, X to Y" line; contextual **Set date
  / Change date** button.
  - **Won-the-vote copy (slice 2 refinement):** `X to Y` from the frozen
    `won_votes`/`runner_up_votes` tally. Two special cases: both **0** (auto-scheduled into an empty
    slot with no votes in play — the bootstrap pick) reads **"First in the queue"** (nothing was
    won); **equal but non-zero** — the oldest-proposal tie-break can promote a pick with the same
    count as the runner-up — reads **"Won on the tie-break, N each"** ("Won the vote, 2 to 2" reads
    as a contradiction). Otherwise **"Won the vote, X to Y"**. This line is **dashboard-only**: the
    kit's sidebar Up Next card (`Shell.jsx`) shows eyebrow + title + "Proposed by" only, never the
    won-vote line, so there is no matched-copy obligation across surfaces for it (unlike
    `NO DATE YET`, which the sidebar does reuse — see §7c).
- **Vote list (right):** "Up for the vote" header + "Propose a title" button (opens the import
  dialog); ranked rows (rank number, poster, title, type badge, proposer avatar, thumbs-up vote
  toggle with live count). Long lists scroll **within** the card (fixed ~6-row height) so the
  dashboard layout stays put — the kit's 4 rows were demo data, not a cap.
- **Remove affordance (not in the kit; spec-granted):** the Decisions Log grants members "remove",
  and the `DELETE /api/queue/[id]` endpoint exists, but the kit designed no control for it. Each
  vote-list row (and the scheduled card) carries a **hover-revealed remove icon** (always visible on
  focus for keyboard/touch a11y) that opens the app's existing `ConfirmDeleteDialog`
  (`src/components/media/confirm-delete-dialog.tsx`, reused) -> on confirm calls `DELETE`. Removing
  the scheduled pick is the documented escape hatch (the next proposal auto-fills the slot).
- **Empty state:** nothing proposed or scheduled -> section stays visible with "Nothing scheduled
  yet, propose something" + Propose CTA.

> **Deferred UI affordances (capability built, control pending).** Two buttons render but aren't yet
> fully wired, tracked here so they aren't mistaken for done: (1) **"Set date / Change date"** — the
> `PATCH /api/queue/[id]/schedule` endpoint works, but the button has no `onClick`; it needs a
> date-picker dialog (a follow-up, not yet sliced). (2) **"Propose a title"** on the vote list —
> opens the import dialog, which is **slice 4**. The **remove** affordance above is built now (its
> endpoint
>
> - the reusable confirm dialog already exist, so it has no dependency). Grid note: the two columns
>   are **50/50** (`grid-cols-2` = `1fr 1fr`), matching the kit's current `1fr 1fr`.

### 7b. Import-dialog Propose button

`src/components/media/import-media-dialog.tsx`. A "Propose" button next to the existing Watchlist
button on each result row (kit: `<I.Users /> Propose`). States: default "Propose" -> on click posts
to `/api/queue/propose` -> disabled "Proposed" with a check (`.cdb-imp-proposed`). If the title is
already actively queued, it renders "Proposed" immediately. (Read the current row layout when
building; pattern is "mirror the Watchlist button.")

### 7c. Sidebar Up Next integration

`src/hooks/use-up-next.ts` + `src/components/sidebar/up-next-card.tsx`. New source priority:

1. **`scheduled` queue pick** (if any) -> label `UP NEXT · {date | NO DATE YET}`, "Proposed by
   {name}" copy.
2. top "watching" watchlist entry (existing).
3. top "planning" watchlist entry (existing).
4. hidden (existing).

`useUpNext()` gains a queue check at the top of the priority order; the card renders the "Proposed
by" variant when the source is the queue. Existing watchlist behavior remains the fallback (no
regression for groups not using the queue).

### 7d. Watchlist-item Propose affordance (deferred)

Lighter "Propose to group" on personal watchlist items, reusing `/api/queue/propose`. Deferred
follow-up slice, described not built now.

---

## 8. Testing

### Strategy correction (2026-06-20, slice-1 implementation)

The original draft of this section said "API/DB tests run against the test Neon branch" and called
for Vitest unit tests over `advanceQueueOnWatch` and the route handlers directly. **That was a
mistake — it specced testing infrastructure the repo does not have.** Auditing the actual suite
before writing tests revealed:

- Every DB-touching Vitest file mocks the client (`vi.mock("@/lib/db", () => ({ db: {} }))`); the
  established pattern is to **extract pure logic into separately-testable functions** (e.g.
  `computeConfidence`, `computeGenreSignal` in `src/lib/predictions/`) and unit-test those, while
  the raw SQL never runs under Vitest.
- There is **no Vitest-against-real-DB harness** — no per-test DB connection, transaction rollback,
  or state-reset machinery. `vitest.config.ts` runs jsdom with a trivial setup file.
- Real DB behavior is exercised only by **Playwright E2E** (`e2e/core-flow.test.ts`) against the
  `.env.test` Neon branch via `db:migrate:test`.

Building a Vitest+real-DB integration harness (the "most faithful" option) was rejected for slice 1:
it introduces test infrastructure the repo doesn't have (connection lifecycle, per-test isolation,
CI wiring) — a larger, riskier change than the feature itself, and out of scope for a foundation
slice. **Chosen approach: extract pure logic + E2E the wiring**, consistent with how
`predictions/signals` is already tested.

### What that means concretely

- **Pure-logic unit tests (Vitest, mocked db):** extract the testable decisions out of the SQL into
  pure functions and test those exhaustively:
  - `rankProposals(proposals)` — votes DESC, then `proposed_at` ASC (oldest-proposal tie-break).
  - `pickNextScheduled(proposals)` — who promotes given a ranked set (and `null` when empty).
  - `decideWatchClose({ proposal, dateWatched })` + `isHistoricalBackfill(dateWatched, proposedAt)`
    — the close/promote/no-op decision incl. the backfill grace day (replaced `decideAdvance`,
    2026-07-04 revision).
  - The promote status-predicate race guard (`promoteTopProposal`'s `status='proposed'` UPDATE
    predicate) is deterministically untestable in e2e and has no unit seam — covered by reasoning
    - the single-scheduled unique-index backstop, not by a test.
  - propose dedup decision (active title -> surface existing) where it can be isolated from the
    write.
- **E2E (Playwright, `.env.test` Neon branch):** the SQL/route integration that the unit layer can't
  reach — partial unique indexes (active-per-media, single-scheduled), vote idempotency via the
  unique constraint, the `advanceQueueOnWatch` hook firing inside the `POST /api/sessions`
  transaction, schedule set/change, delete + audit row. These ride the existing E2E infra.
- **Component (slice 2+):** queue section renders scheduled + ranked list; empty state; optimistic
  vote flip; dateless "NO DATE YET" + contextual button label.
- **Migration:** no Vitest up/down harness exists; the round-trip is verified by running
  `db:migrate:test` up then `db:migrate:down` against the test branch (manual/E2E infra), not a unit
  test.

---

## 9. Build Slices

Ordered as small, shippable PRs (parent spec's "small reviewable PRs" ethos). This is the plan;
implementation is deferred to follow-up sessions.

1. **Schema + core API** — migration (both tables + partial unique indexes), Kysely types,
   `/api/queue` GET + propose/vote/schedule/delete, `advanceQueueOnWatch` wired into
   `POST /api/sessions`. No UI. Fully testable headless. _Foundation; everything depends on it._
2. **Dashboard queue section** — `useQueue()`, `up-next-queue.tsx`, empty state. The visible
   centerpiece.
3. **Real-time** — `group:queue` channel, token capability, publish helpers, Ably subscription in
   `useQueue()`, optimistic vote. (Isolated from slice 2 for review clarity; could fold in.)
4. **Import-dialog Propose button** — primary entry point.
5. **Sidebar Up Next integration** — queue-first source priority.
6. **(Follow-up, separate)** Watchlist Propose affordance **+** FeaturedBand picker/attendee
   enrichment (the deferred parent-spec #3, now unblocked).

Slice 1 is the foundation; the rest land roughly in order as independent PRs.

---

## 10. Open Questions

None. All brainstorming open questions resolved (see Decisions Log). Implementation-time details
(exact dialog row layout, precise Tailwind class mapping from `.cdb-queue-*`) are read-and-match
tasks during the relevant slice, not design decisions.
