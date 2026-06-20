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

| Decision                   | Choice                                                                                                                                                                      | Rationale                                                                                                                                                                                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema shape               | **Dedicated tables** (`queue_proposals` + `queue_votes`)                                                                                                                    | Isolates the feature from stats/timeline/featured aggregate queries; no blast radius on `watch_sessions`. Extending `watch_sessions` with a status was rejected: disjoint columns, a permanent `WHERE status='watched'` correctness tax on every existing aggregate, and votes need their own table regardless. |
| Voting model               | **Unlimited upvotes**, one per proposal per person, ranked by total                                                                                                         | Matches the kit's `toggleVote`; hard to game in a small friend group; no "spend wisely" friction.                                                                                                                                                                                                               |
| Vote count storage         | **Derived** (`COUNT(queue_votes)`), never a stored counter                                                                                                                  | Free over a tiny table; makes counter drift impossible. Revisit only under measured read pressure.                                                                                                                                                                                                              |
| Promotion                  | **Auto-promote** top-voted into a **dateless** scheduled slot when the current pick is logged watched                                                                       | Keeps the slot a live anchor (never empty while proposals exist); date is a deliberate human act, not guessed (movie nights land on irregular days).                                                                                                                                                            |
| Tie-break                  | **Oldest proposal** (`proposed_at` ASC) wins                                                                                                                                | Deterministic, rewards patience, no UI needed. Runner-up stays #1 for next time.                                                                                                                                                                                                                                |
| Permissions                | **Any member, full trust** (propose / vote / schedule / change date / remove)                                                                                               | Matches the friend-group ethos and the kit (no gating shown). Destructive actions audit-logged.                                                                                                                                                                                                                 |
| Override / force-push      | **None.** Votes + automation only                                                                                                                                           | Not in the kit; a mod-only force-push would contradict full-trust (members can already schedule/remove). Escape hatch already exists: remove the scheduled proposal -> next promotes, or vote a title up.                                                                                                       |
| Real-time                  | **Live via Ably** (`group:queue` channel) + SWR optimistic on the actor's own vote                                                                                          | Picking is a shared-moment activity; live pays off. Reuses the existing `presence:group`-style group-broadcast pattern.                                                                                                                                                                                         |
| Advance trigger            | **Approach A** — hook `advanceQueueOnWatch(trx, mediaId)` into the existing `POST /api/sessions` transaction                                                                | Single source of truth for "this is done"; atomic with the log; mirrors the existing watchlist auto-removal in that route.                                                                                                                                                                                      |
| Advance scoping            | **Creation only.** Do NOT unwind the advance on session edit/delete                                                                                                         | Reversing a promotion adds real branching complexity for a near-never event. Accidental log-then-delete leaves the queue one step ahead, fully recoverable by re-proposing; audit-logged so it's not mysterious.                                                                                                |
| Duplicate proposals        | **One active entry per media** (DB partial unique index). Re-proposing an active title surfaces/votes the existing one; re-proposing a watched title is allowed (re-watch). | Keeps the list clean, prevents vote-splitting.                                                                                                                                                                                                                                                                  |
| Empty state                | **Dashboard mirrors the sidebar CTA** ("Nothing scheduled yet, propose something")                                                                                          | Section stays visible as an invitation rather than vanishing.                                                                                                                                                                                                                                                   |
| Dateless copy              | **"NO DATE YET"** on both the sidebar Up Next card and the dashboard scheduled card                                                                                         | Matched copy (differing wording reads as a bug). Preserves the eyebrow structure so layout doesn't shift between dated and dateless.                                                                                                                                                                            |
| Contextual schedule button | **"Set date"** when `scheduled_date` is null, **"Change date"** when a date exists                                                                                          | Makes the dateless state advertise its own fix.                                                                                                                                                                                                                                                                 |
| Watched proposals          | **Persist as history** (status `'watched'`, linked to the `watch_sessions` row)                                                                                             | Feeds the FeaturedBand enrichment ("Picked by", "Won the vote") and the "Won the vote, X to Y" record. Trivial row cost.                                                                                                                                                                                        |

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

| Column               | Type                                                               | Notes                                                        |
| -------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| `id`                 | uuid pk                                                            |                                                              |
| `media_id`           | uuid -> `media(id)` ON DELETE CASCADE                              |                                                              |
| `proposed_by`        | uuid -> `users(id)` ON DELETE SET NULL                             | proposer; SET NULL keeps the proposal if the user is deleted |
| `status`             | text `'proposed' \| 'scheduled' \| 'watched'` default `'proposed'` | drives the lifecycle                                         |
| `scheduled_date`     | date null                                                          | set/changed by a member; `null` = "scheduled, no date yet"   |
| `scheduled_at`       | timestamptz null                                                   | when promoted into the slot (ordering/history)               |
| `watched_session_id` | uuid null -> `watch_sessions(id)` ON DELETE SET NULL               | links a watched proposal to its real session (Approach A)    |
| `proposed_at`        | timestamptz default now()                                          | tie-break key                                                |
| `created_at`         | timestamptz default now()                                          | `TimestampColumns`                                           |
| `updated_at`         | timestamptz default now()                                          | `TimestampColumns`                                           |

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

| Route                      | Method          | Behavior                                                                                                                                                                                                                                                                  |
| -------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/queue`               | `GET`           | Returns `{ scheduled, proposals }`. `scheduled`: the scheduled pick (proposer, media, `scheduledDate`, vote tally) or `null`. `proposals`: ranked list (votes DESC, then `proposed_at` ASC), each with media, proposer, `voteCount`, and `hasVoted` for the current user. |
| `/api/queue/propose`       | `POST`          | Body `{ mediaId }`. Creates a `proposed` row. If an active proposal for that media exists, **no-op that returns the existing one** (surfaced to the UI as already-proposed). Audit-logged (`queue.proposed`).                                                             |
| `/api/queue/[id]/vote`     | `POST`/`DELETE` | Toggle the current user's vote (insert/delete the `queue_votes` row). Idempotent via the unique constraint.                                                                                                                                                               |
| `/api/queue/[id]/schedule` | `PATCH`         | Body `{ scheduledDate }`. Sets/changes the date on the scheduled pick ("Set date" / "Change date").                                                                                                                                                                       |
| `/api/queue/[id]`          | `DELETE`        | Removes a proposal (any member). Audit-logged (`queue.removed`).                                                                                                                                                                                                          |

### The advance-on-watch hook (Approach A)

New helper `advanceQueueOnWatch(trx, mediaId)` in `src/lib/queue/advance.ts`, called **inside the
existing `POST /api/sessions` transaction**, adjacent to the current watchlist auto-removal
(`src/app/api/sessions/route.ts`, currently lines 265-270):

1. Find the `scheduled` proposal. If its `media_id` matches the session's media, set
   `status='watched'`, `watched_session_id = newSession.id`.
2. Promote the next pick: top proposal by `COUNT(votes) DESC, proposed_at ASC` ->
   `status='scheduled'`, `scheduled_at=now()`, `scheduled_date=null` (dateless).
3. If no proposals remain, the slot is empty (drives the empty state).
4. If the logged media is **not** the scheduled pick, the helper is a **no-op** (logging an
   off-queue watch doesn't disturb the queue).

Because it runs in the transaction, the advance is atomic with the log: the log commits and the
queue advances, or both roll back. The advance is audit-logged (`queue.advanced` with the watched +
newly-scheduled proposal IDs) so an unexpected promotion has a trail.

**Not unwound** on session edit/delete (decisions log). The proposal stays `watched`; recovery is to
re-propose, which works because watched rows don't hold the active-unique index.

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
- **Vote list (right):** "Up for the vote" header + "Propose a title" button (opens the import
  dialog); ranked rows (rank number, poster, title, type badge, proposer avatar, thumbs-up vote
  toggle with live count).
- **Empty state:** nothing proposed or scheduled -> section stays visible with "Nothing scheduled
  yet, propose something" + Propose CTA.

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

Vitest + RTL, matching existing patterns. API/DB tests run against the test Neon branch
(`pnpm db:migrate:test` / `pnpm test:e2e` infra).

- **Unit:** `advanceQueueOnWatch` (promotes top-voted; oldest-proposal tie-break; no-op on off-queue
  media; empty-queue handling). Ranking/tie-break query.
- **API:** propose (dup -> no-op returns existing); vote toggle (idempotency via unique constraint);
  schedule (set/change date); delete + audit log.
- **Component:** queue section renders scheduled + ranked list; empty state; optimistic vote flip;
  dateless "NO DATE YET" + contextual button label.
- **Migration:** up/down round-trip check (matches existing migration test style).

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
