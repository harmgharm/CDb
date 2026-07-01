# CDb Design System — Second Pass (Drift Audit & Rollout)

**Status:** Active (per-page audit, work one page at a time) **Date:** 2026-06-28 **Owner:** dev

---

## 1. Why this exists

The first rollout (`2026-05-22-design-system-rollout-design.md`, Phases 0–12) brought the warm-dark
/ marquee-amber identity into the app and rebuilt every surface once. It got us most of the way, but
several sections stopped at "data present, editorial framing missing," and a few drifted in layout
or section order from the kit (`CDb Design System/ui_kits/web/`).

This document is the **second pass**: close the remaining gap between the live app and the kit, page
by page. It is a living checklist, not a phased spec. The homepage has the most drift; the other
pages should have far less.

### Decisions (pinned)

| Decision        | Choice                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| Fidelity        | **Pixel-faithful to the kit.** Match structure, order, and section styling.                                       |
| Exceptions      | Flag anything worth keeping as-is in the audit; default is "match the kit."                                       |
| Process         | Per-page drift audit → approve checklist → implement that page → next page.                                       |
| Kit placeholder | The kit uses mock/placeholder data (e.g. `Math.random()` divisiveness). We wire **real** data; match layout only. |
| New data        | New DB queries are allowed where the kit's design needs data we don't yet aggregate.                              |
| Doc location    | This file. One `## Page —` section per surface, each with a checklist.                                            |

### Cross-cutting (inherited from the first spec — still apply)

- Lucide icons only, no emoji. Voice: "the group" / "friends", never "users".
- Title Case nav/titles, sentence case body, UPPERCASE only on `.eyebrow` micro-labels.
- **No em-dashes** in user-facing copy. Star always `fill-amber-500 text-amber-500`. Cherry red =
  live-multiplayer signal only.
- Don't touch `src/components/ui/` primitives. Don't regress unrelated screens. Reasonable in light
  mode (no broken contrast), polish not required.

---

## 2. Page drift ranking (work order)

Homepage first (worst drift), then descending. Each page gets audited just before we pick it up, so
the lower rows are placeholders until then.

1. **Home / Dashboard** — ✅ implemented (below). Highest drift.
2. **Database** — ✅ implemented (below). Low drift (Phase 6 shipped
   masthead/featured/filters/timeline).
3. **Media detail** — ✅ implemented (below). Done out of order, owner-driven (kit barely mocks it).
4. **For You (recommendations)** — ✅ implemented (below).
5. **Users + User Profile** — ✅ implemented (below). Low drift.
6. **Settings** — ✅ implemented (below). Lowest drift so far.
7. **Auth (login / signup)** — ✅ implemented (below). Low drift, copy + spacing only.
8. **Landing** — ✅ implemented (below). Low drift, sizing/alignment only.
9. **Play hub** — next, to audit

---

## Page — Home / Dashboard ✅ implemented (pending review)

Implemented 2026-06-28. Backend slice is TDD (17 new tests in
`tests/lib/stats/viewing-habits.test.ts`). `pnpm typecheck`, `pnpm lint`, `pnpm test` (513),
`pnpm build` all green. Decisions made during the build, for the reviewer:

- **Log session button → `ImportMediaDialog`** (confirmed with owner): same dialog the queue's
  "Propose a title" uses. The app has no title-agnostic log flow; you log against a specific title.
- **Two new aggregates added to `/api/stats/detailed`** (not a new endpoint):
  `watchingHabits.weekday` (Monday-first day-of-week histogram) and
  `watchingHabits.avgSessionLength`. They sit beside the streak/avg-start data already there; SWR
  dedupes the single request shared with Deep Cuts.
- **Group Leaders meta** shows the kit's "N picks · M watched". A `watchedCount` (distinct attended
  sessions per user, from `session_attendees`) was added to `PickerLeaderboardEntry` via a small
  query (`fetchWatchedCounts`) + a pure `mergeWatchedCounts` helper (TDD, 4 tests). Avg-pick was
  dropped from the meta line since the avg score already shows on the right.
- **Highest-rater heart icon uses `rose-500`, not cherry** — the kit tints this icon cherry, but the
  cross-cutting rule reserves cherry for live-multiplayer signals only. Resolved in favour of the
  project rule: use `text-rose-500` (the shade the pre-redesign card already used), which keeps the
  heart warm and distinct from the amber Trophy / tv-blue Users icons without touching a cherry
  token.
- **Most Divisive** keeps our real divisiveness; kit's `Math.random()` σ values are placeholder
  only.

**Second-review follow-ups (2026-06-28, all TDD where logic changed):**

- **Now Showing is now group-level rating progress** (was "did I personally rate it"). The subline
  reads the kit's "N / M rated" / "K still rating". `/api/sessions` gained per-session
  `attendee_count` + `rated_count` (correlated subqueries, independent of the userId join filter);
  `selectNowShowing` classifies on those counts (rated when all attendees rated; 0 attendees → rated
  so no "0/0" state). The header's "still rating" subtitle count now derives from this same
  group-level signal, so it reflects the whole group, not just the viewer.
- **Deep Cuts tab counts are now real totals** (were the shown top-5 slice length). Added a `totals`
  block to `/api/stats/detailed` computed from the full formatted arrays before slicing (genres /
  directors / cast lengths, year range min–max, picker count) plus `fetchRatedTitleCount` (distinct
  titles with ≥2 ratings, matching the ranked-list threshold). Tabs show e.g. "423 names",
  "1957–2026".
- **Header subtitle** confirmed working: it was correctly showing the evergreen fallback because the
  test account currently has 0 open proposals and 0 still-rating sessions. The data line appears
  once either count is > 0.

Kit reference: `CDb Design System/ui_kits/web/Dashboard.jsx` + `kit.css` (`cdb-now-*`,
`cdb-stat-strip`, `cdb-queue-*`, `cdb-cast-*`, `cdb-two-col`, `cdb-leader-*`, `cdb-watch-*` /
`cdb-vh-*`, `cdb-deep-*`). Current: `src/app/(main)/home/page.tsx` + `_components/*`.

### Kit section order (target)

1. Header — "Tuesday at CDb" + **data subtitle** + **Log session** button
2. **Now Showing** (2 cards: rated + in-progress)
3. Compact stat strip (7-up)
4. **Up Next & the queue** (scheduled pick + vote list)
5. **The Cast This Month** (Top Picker / Highest Rater / Most Active — eyebrow + rule header)
6. **Group Leaders + Viewing Habits** (two-column: leaders list ‖ streak + 7-day bar chart)
7. **Deep Cuts** (left-rail tabbed switcher: Ratings / Genres / Directors / Cast / Years / Pickers)
8. Recent Activity feed

### Current order (live)

`DashboardHeader → UpNextQueue → NowShowing → StatStrip → GroupStats → GroupDetailedStats → ActivityFeed`

### Drift checklist

- [x] **Section order.** Swap so Now Showing sits **above** the queue, and insert the stat strip
      between them. Target order: Header → NowShowing → StatStrip → UpNextQueue → CastThisMonth →
      (GroupLeaders ‖ ViewingHabits) → DeepCuts → ActivityFeed. (Today the queue is above Now
      Showing and the strip is below both.)

- [x] **Header — Log session button.** Kit's `PageHeader` has a primary `Log session` button in the
      `action` slot; current `DashboardHeader` has no action. Add it, wired to the existing
      log-session entry point (reuse whatever the rest of the app uses to open the log-session flow,
      not a new dialog).

- [x] **Header — data subtitle.** Current subtitle is the static
      `"Here's what the group has been watching."` The header comment deferred the data-driven
      version until the queue existed. The queue (Phase 12) has now shipped, so build the real
      subtitle: kit shows `"4 up for the vote · 2 still rating."` Derive from queue proposal count +
      in-progress (unrated) session count. Use `·` separator, sentence case, no em-dash.

- [x] **The Cast This Month.** `GroupStats` already renders the three human cards (Top Picker /
      Highest Rater / Most Active) on real data. Add the kit's editorial framing: `cdb-eyebrow` "The
      cast this month" + flex-fill horizontal rule header (`cdb-hl-eyebrow` / `cdb-hl-rule`), and
      restyle the cards to `cdb-cast-card` (48px avatar, icon-tinted label, name + stat). Keep the
      data wiring.

- [x] **Group Leaders (new).** A 5-row leaders list (rank + avatar + name + "picks · watched" meta +
      avg score) in the left column of the two-col row. Data: reuse the picker / attendance / avg
      aggregates already feeding `GroupStats` and the picker leaderboard. No new query expected;
      confirm during implementation.

- [x] **Viewing Habits (new — needs data).** Right column of the two-col row. The kit card has: -
      14-day best-streak header + "active streak of N" → **existing** `longestStreak` /
      `currentStreak` from `src/lib/stats/streak.ts`. - 7-day day-of-week bar chart (Mon–Sun session
      counts, peak day highlighted amber) → **NEW DB query** (day-of-week session aggregation,
      `EXTRACT(DOW ...)`; none exists today). - Meta row: Slot ("Sunday nights", derived from peak
      day) · Avg start (**existing** `avgStartTime`) · Avg length ("2h 18m") → **NEW**: avg session
      duration is not computed today. Recommend adding it (cheap aggregate). If we skip it, drop
      that one meta cell.

- [x] **Remove the 4 hero-stat cards.** Once Viewing Habits absorbs streak + avg start, the
      `GroupDetailedStats` hero row (`Watch Streak / Hours Watched / Avg Start Time / Avg Rating`)
      becomes redundant and the kit has no equivalent. Delete it. Nothing is lost: Hours and Avg
      Rating already live in the 7-up stat strip; Streak and Avg Start move into Viewing Habits.

- [x] **Deep Cuts — accordion → tab rail (layout rebuild).** Current `GroupDetailedStats` renders
      six stacked `StatsSection` accordions. Rebuild as the kit's `cdb-deep` card: left rail of tabs
      (Ratings / Genres / Directors / Cast / Years / Picker Leaderboard, each with an icon + count),
      one active section in the content pane. Reuse the existing stat list components
      (`RankedMediaList`, `DivisiveMediaList`, `CategoryStatList`, `PickerLeaderboard`) inside the
      new layout; only the chrome changes. **Decision (resolved): go with the tab rail** even though
      the accordion can show several sections at once — cleaner wins here.

- [x] **Recent Activity.** Already present and structurally fine. Verify chrome matches the kit's
      `cdb-feed` / `FeedItem` treatment (icon chip for sessions, avatar for ratings, star + score,
      optional review quote). Token-level only.

### Keep as-is (flagged, not matching the kit literally)

- **Most Divisive σ values** — kit uses `Math.random()`. We keep our real divisiveness computation
  and match the layout only.

### Net new backend work for this page

- Day-of-week session-count aggregation (for the Viewing Habits bar chart). **Required.**
- Avg session duration aggregation (for the "Avg length" meta cell). **Recommended**; drop the cell
  if we choose not to.

### Acceptance (homepage)

- [x] `pnpm typecheck && pnpm lint && pnpm test` pass.
- [x] Section order matches the kit (NowShowing → strip → queue → cast → leaders‖habits → deep →
      activity).
- [x] Header has a working Log session button and a data-driven subtitle.
- [x] The Cast This Month has the eyebrow+rule header and cast-card styling on real data.
- [x] Group Leaders list renders 5 real members; Viewing Habits renders the streak header, the 7-day
      bar chart (real day-of-week data), and the meta row.
- [x] The 4 hero-stat cards are gone; no stat is lost (Hours/Avg in strip, Streak/Start in habits).
- [x] Deep Cuts is a left-rail tab switcher with all six categories on real data.
- [x] Light mode: dashboard readable, no broken contrast, no missing tokens.
- [x] No regression on at least one other screen (smoke check).

---

## Page — Database ✅ implemented (pending review)

Audited 2026-06-29, implemented 2026-06-29. **Low drift** — Phase 6 of the first rollout already
shipped the editorial masthead, Featured band, conversational filters, and the timeline view, so the
page's structure and section order already match the kit. The remaining gap was in the **card
chrome** (grid + list) plus two small editorial touches. No section needed reordering; no component
was rebuilt.

Backend slice is TDD (9 new tests in `tests/lib/media/list-row.test.ts`). `pnpm typecheck`,
`pnpm lint`, `pnpm test` (527) all green. Reviews: manual visual pass (headless screenshots) +
`feature-dev` code-reviewer — **no material issues**. Implementation notes for the reviewer:

- **`avg_rating` is always-selected, coerced via a pure helper.** `/api/media` lifts the existing
  rating-sort `AVG(score)` subquery onto the base query so every response carries it; the `[id]`
  detail route mirrors it for `MediaDetail` consistency. `coerceAvgRating` / `mapMediaListRow`
  (`src/lib/media/list-row.ts`) parse the Postgres numeric **string** to a one-decimal number (the
  SQL is typed `string | null` to match runtime, per the reviewer's note + the codebase's
  `::text`-cast convention). Verified live: rated titles return real averages, unrated return null,
  detail `avg_rating` === `stats.avgRating`.
- **Grid stays 5-up** (owner call) with full kit card chrome: `bg-card` meta band, page-absolute
  mono rank (`#NN`, shared `MEDIA_PAGE_SIZE` so it can't drift from the list `limit`), type badge
  top-left, group-rating star badge top-right (hidden when unrated). Status badge relocated into the
  submeta line as a text token (no data lost).
- **List rows** use `bg-card hover:bg-accent` (the timeline's lighter fill); shadcn `Table`
  primitive untouched.
- **Issue-line eyebrow → `font-semibold`** in the shared `EditorialMasthead` (also thickens the For
  You masthead — confirmed by owner as the intended fix for both).
- **Footer dashes: en-dash, not em-dash.** Kit uses em-dashes (`— end of issue —`); our
  cross-cutting rule bars em-dashes in user copy, so this renders `– end of issue –` (en-dash).
  Owner was fine either way; en-dash keeps the look and honors the rule.
- **Featured-band overflow fix (bonus, in scope-adjacent).** The band's grid used bare `2fr_1fr`
  tracks, which floor at min-content; a supporting card's long title refused to shrink (its
  `truncate` never engaged) and pushed the band — and the page — past the viewport. Changed to
  `minmax(0,2fr)_minmax(0,1fr)` (the min-content trap from our own notes). This eliminated the
  **grid-view** horizontal overflow entirely.

### Horizontal overflow — RESOLVED (commit `f85b697`)

The Database list view (and, in a narrow 900–940px band, grid too) pushed the whole page into a
horizontal scrollbar. Three layered causes, none of them the sidebar breakpoint: (1) the featured
band's bare `2fr/1fr` grid tracks floored at min-content (fixed earlier with `minmax(0,…)`); (2) the
flex content column couldn't shrink (`min-w-0` added to `SidebarInset` + inner `<main>` + a
`w-full min-w-0` MediaTable wrapper, so the table's own `overflow-x-auto` box is the scroll
boundary); (3) the real 900–940px-band culprit — the conversational-filters action row's `sm:w-auto`
let the button cluster size to its content (`max-w-full` added so its existing `flex-wrap` engages).
Shadcn primitives untouched (all via `className`). Verified 0px overflow across 375–1920px on
database/for-you/users/play/settings; reviewed by a feature-dev code-reviewer (no adverse
shared-component effects).

### ⚠️ Deferred to a dedicated mobile-responsiveness pass

- **Homepage overflows badly on phones (desktop-first layout, no mobile breakpoints).** Surfaced
  during the overflow-fix width sweep; **pre-existing**, unrelated to the Database work (the
  homepage doesn't use any component touched here). Overflow is ~250–290px at common phone widths
  and clears only at ~768px: 320px → 327px over, 360px (Android) → 287px, 390px (iPhone 12–14) →
  257px, 430px (Pro Max) → 217px, 600px → 47px, 768px → clean. The roughly-constant overshoot points
  to a fixed-minimum-width section (~620–650px) that doesn't respond to the viewport — likely the
  queue / Deep Cuts / two-col dashboard rows. **Owner decision: roll this into a dedicated mobile
  pass** rather than a one-off — the design-system second pass has been desktop-focused, and other
  pages likely have similar mobile issues worth fixing together. Target floor for that pass: **clean
  down to 320px** (360px is the practical phone minimum; 320 = smallest device still in real use).

Kit reference: `CDb Design System/ui_kits/web/Database.jsx` + `kit.css` (`cdb-poster-grid`,
`cdb-grid-card`/`-overlay`/`-score`/`-meta`/`-rank`/`-title`/`-submeta`, `cdb-db-table`,
`cdb-db-issue`/`-issue-date`, `cdb-eyebrow`, `cdb-db-footer`). Current:
`src/app/(main)/database/page.tsx` + `src/components/media/media-card.tsx`,
`src/components/media/media-table.tsx`, `src/components/editorial/editorial-masthead.tsx`.

### Decisions made / judgment calls (for the reviewer)

- **Grid stays 5-up, not the kit's 6-up.** The kit fixes the grid at `repeat(6, 1fr)` with smaller
  posters; ours is responsive (1→2→3→4→5 across breakpoints). **Owner chose to keep our cinematic
  density** (#2 in the audit question) rather than match the kit literally. Reasoning agreed with
  the owner: grid and list serve _different_ jobs — list view already exists for dense scanning, so
  the grid keeps its distinct cinematic purpose; the new rank numbers + meta footer give the
  "catalog" feel without shrinking posters. Flagged as **keep-as-is** below. (Trying 6-up live later
  is a one-line `xl:grid-cols-6` change.) We still adopt **all** the kit's card chrome.
- **Group-rating badge: wired to real data.** The kit's grid card shows a top-right star+score badge
  ("group avg"). `MediaListItem` has no group average today (only `tmdb_rating` / `mal_score`), BUT
  `/api/media/route.ts` already computes the exact value — a correlated `AVG(r.score)` subquery —
  and uses it for `sortBy === "rating"` ordering. We **always-select** that subquery as
  `avg_rating`, return it per item, and render the badge. Titles with no group ratings yet render
  **no badge** (not a "0.0"). Low risk: no new join, reuses existing SQL.
- **Issue-line font weight (owner point #1).** The kit's left eyebrow (`cdb-eyebrow`, "CDb · Issue
  #14") is JetBrains Mono **weight 600**; our `EditorialMasthead` renders both sides at the default
  400, which reads thinner. Bump the **left eyebrow to 600** (`font-semibold`). The right side
  (`cdb-db-issue-date`, "May · MMXXVI") is weight 400 in the kit too, so it stays as-is. NOTE:
  `EditorialMasthead` is shared (For You reuses it) — changing the eyebrow weight affects For You's
  masthead too. That's acceptable (the kit's `cdb-eyebrow` is globally 600), but call it out at
  review so the For You audit doesn't re-flag it.
- **"end of issue" footer (owner point #5).** New. Add the kit's `cdb-db-footer`: a centered
  `— end of issue —` eyebrow with a top rule (`border-t`), at the very bottom of the page. Purely
  decorative; ties off the editorial frame. Does not render in the empty/no-media state (no issue to
  end).
- **The "lighter color" (owner point #4)** is `var(--bg-elev-2)`, surfaced in the app as the
  `bg-card` utility (the timeline's inner cards already use it). Grid cards and list rows adopt it.

### Kit section order (target)

1. Editorial header (eyebrow + issue date over a rule · serif "The _collection_" title · italic
   lede)
2. Featured this month (1 hero poster + 3 supporting)
3. Conversational sort/filter line + actions (search · view toggle · refresh · add)
4. Archive body — grid **or** list **or** timeline
5. Pagination (grid/list only)
6. `— end of issue —` footer

### Current order (live)

`EditorialMasthead → FeaturedBand → ConversationalFilters → (MediaArchive | TimelineArchive) → ImportMediaDialog`

Order already matches the kit. **Only the footer (item 6) is missing**; everything else is present
and correctly ordered.

### Drift checklist

- [x] **Issue-line eyebrow weight.** In `EditorialMasthead`, set the **left** eyebrow span to
      `font-semibold` (600) to match the kit's `cdb-eyebrow`. Leave the right `issueLine` span
      at 400. (Owner point #1.)

- [x] **Grid card — lighter card fill + bottom meta band.** Give `MediaCard` a `bg-card`
      (`--bg-elev-2`) background so the area under the poster reads as a lighter slab, matching the
      kit's `cdb-grid-card` (`background: var(--bg-elev-2)`) and the timeline cards. (Owner point
      #4.)

- [x] **Grid card — rank number.** Add the kit's `cdb-grid-rank`: a mono, dimmed, zero-padded index
      (`#01`, `#02`, …) at the start of the meta footer. Numbering is **page-absolute**
      (`(page - 1) * limit + index + 1`), matching the kit's `(safePage-1)*PAGE_SIZE + i + 1`. Needs
      the page's `limit` (20) and current page passed down to the card (or computed in the page and
      passed as a prop). (Owner point #3.)

- [x] **Grid card — type badge top-LEFT.** Today the type badge sits bottom-left over the poster
      (`absolute right-2 bottom-2 left-2`). Move it to the **top-left** corner overlay to match the
      kit's `cdb-grid-overlay` (`top:0; justify-content: space-between`). (Owner point #3.)

- [x] **Grid card — group-rating badge top-RIGHT.** Add a star+score pill in the top-right of the
      overlay (kit `cdb-grid-score`: dark translucent bg, `cdb-star` amber, mono). Star is always
      `fill-amber-500 text-amber-500`. Hidden when the title has no group rating. Requires the
      backend change below. (Owner point #3.)

- [x] **Grid card — meta submeta line.** Keep year · runtime · eps but render under the rank/title
      in the kit's `cdb-grid-submeta` style (small, `--fg-muted`, `·` separators). The "Returning
      Series / Currently Airing" status badge currently shown bottom-right has no kit equivalent on
      the card; **keep it** but relocate it into the submeta line as a text token (don't drop data).
      Flag at review.

- [x] **List view — lighter row fill.** The kit's list (`cdb-db-table`) reads as filled rows; ours
      is a bare bordered `Table` on the page background. Give the table rows / wrapper the `bg-card`
      (`--bg-elev-2`) treatment so each entry's slot is the lighter color, matching the timeline's
      inner cards. Token-level only; do **not** restyle the shadcn `Table` primitive in
      `src/components/ui/` — apply via `className` on our `MediaTable` wrapper/rows. (Owner point
      #4.)

- [x] **"end of issue" footer.** Add a `cdb-db-footer` equivalent at the bottom of the page: a
      top-ruled, centered `— end of issue —` eyebrow (uppercase, `tracking-[0.12em]`,
      `text-[var(--fg-dim)]`). Renders below pagination in grid/list and below the timeline. Skip it
      in the empty-state (no media / no sessions). (Owner point #5.)

### Keep as-is (flagged, not matching the kit literally)

- **Grid density: 5-up, not the kit's 6-up.** Owner decision (see judgment calls). Our responsive
  grid stays `sm:2 md:3 lg:4 xl:5`. Revisit live if it feels sparse.
- **Sort options.** The kit's sort `<select>` lists
  `recently watched / group rating / picker / release year`. Ours lists
  `recently watched / recently added / rating / title / release year` (a deliberate first-rollout
  set; "picker" sort isn't wired and "recently added" / "title" are useful). Keep our set — this is
  functionality, not chrome, and the conversational-filter treatment already matches the kit's
  editorial intent.
- **"Add" button label.** Kit says "Add"; ours says "Add Media". Minor; keep ours (clearer). Not
  worth a churn.
- **Timeline view.** Already shipped (Phase 12 / first rollout) and its inner cards already use the
  `bg-card` lighter fill that points #4 is about. No change.

### Net new backend work for this page

- **Always-select `avg_rating` on the media list** (`/api/media/route.ts`): lift the existing
  rating-sort correlated subquery so it's selected on every request (not only when sorting by
  rating), and add `avg_rating: number | null` to `MediaListItem` + the response mapping.
  **Required** for the grid rating badge. No new table/join. (TDD where there's a pure mapper; the
  SQL itself is covered by an integration smoke since it's a route-level query.)

### Acceptance (Database)

- [x] `pnpm typecheck && pnpm lint && pnpm test` pass.
- [x] Issue-line left eyebrow renders at weight 600 (matches kit); For You masthead unaffected
      visually beyond the intended weight bump.
- [x] Grid cards: lighter `bg-card` meta band, page-absolute rank number, type badge top-left,
      group-rating badge top-right (hidden when unrated), submeta line with year · runtime · eps and
      the relocated status token. Posters stay at current (5-up) density.
- [x] Group rating shows real per-title group averages from `/api/media` (spot-check a rated title
      and an unrated title).
- [x] List rows use the lighter `bg-card` fill (same color as timeline cards); shadcn `Table`
      primitive untouched.
- [x] `— end of issue —` footer renders at the bottom of grid/list/timeline, absent in empty states.
- [x] Light mode: readable, no broken contrast, no missing tokens.
- [x] No regression on the timeline view or the For You masthead (smoke check).

---

## Page — Media detail ✅ implemented (pending review)

Implemented 2026-06-29. **Done out of work order** (owner wanted it before For You) and **mostly not
kit-driven** — the kit's `MediaDetail.jsx` barely mocks this page, so the first rollout only
borrowed a few things and left the rest. The work here was therefore **owner-driven improvements**,
not drift-matching: usability and consistency fixes plus a readability reorder. `pnpm typecheck`,
`pnpm lint`, `pnpm test` (527) green throughout; the app-wide textarea change passed a feature-dev
code-reviewer with no material issues.

Current: `src/app/(main)/database/[id]/page.tsx` + `src/components/media/session-card.tsx`,
`src/components/media/propose-to-queue-button.tsx` (new),
`src/components/editorial/expandable-text.tsx` (new), `src/components/ui/textarea.tsx`.

### What shipped (each its own commit)

- [x] **Propose-to-queue button** (`fa0b8d4`). New `ProposeToQueueButton` beside the watchlist
      button in the Watch Sessions header. Reuses `POST /api/queue/propose` (dedups server-side).
      Reads `useQueue()` for already-queued state; once queued it collapses to a quiet,
      non-interactive "In the queue" tag in the same (left) spot — **not** a dead disabled button,
      and **not** un-proposable from here (un-propose could delete the media entry when it has no
      sessions — rejected as a destructive surprise). Actions row is `flex-wrap` for mobile.

- [x] **Long reviews / session notes truncate with tap-to-expand** (`e5a5a10`, dash fix `5f71e55`).
      New shared `ExpandableText` (`src/components/editorial/expandable-text.tsx`): clamps to 2
      lines, tap/click to expand (not hover → works on touch), affordance only when it actually
      overflows, keyboard-accessible. Wired into **both** the individual reviews and the session
      notes (notes previously had no overflow handling and ran off the card). The individual review
      moved onto its own line below the rating row so it has room to expand; its leading em-dash is
      bonded to the first word with a non-breaking space so it can't strand alone on line 1.

- [x] **Textarea overflow fix — app-wide** (`04083a6`). The shadcn `Textarea` primitive used
      `field-sizing-content`, which sized the textarea to its content's **width**, so a long
      unbroken token (a pasted URL) burst the textarea out of its dialog. Removed it for a fixed
      `min-h`/`max-h` + internal scroll + `min-w-0` + `break-words` + `resize-none`. Affects **every
      dialog textarea** in the app. (Touching the primitive was owner-approved — it's a genuine bug
      fix, not a customization.)

- [x] **Title info-block reorder** (`6cb55b2`). The block led with identity then buried the synopsis
      under reference trivia, with the loud cast photo strip splitting the title from its facts.
      Reordered to read **identity → facts → what it's about → who's in it → trivia**: director,
      title, tagline, badges, genres, **synopsis (moved up from last)**, **cast (moved down from
      4th, kept inline)**, then studio / networks / budget-revenue last. Markup unchanged; only
      order.

### Decisions made / judgment calls (for the reviewer)

- **Cast stays inline** below the synopsis (owner choice) rather than pulled into a separate lower
  "Cast" section — smaller change, keeps the tidy photo strip.
- **Reviews keep the `—` prefix** (distinct from the quoted session notes) rather than switching
  both to quotes — owner wanted them visually distinct.
- **2-line clamp** on both reviews and notes (1 line judged not better). The clamp is one number if
  it ever needs tuning.

### Acceptance (Media detail)

- [x] `pnpm typecheck && pnpm lint && pnpm test` (527) pass.
- [x] Propose button: proposes, persists across reload, dedups, collapses to "In the queue" tag;
      3-button row wraps on mobile (0px overflow at 375px).
- [x] Reviews and notes clamp to 2 lines, expand on tap, affordance only when overflowing; long
      unbroken tokens stay inside the box; the review dash never strands.
- [x] Every dialog textarea keeps long content (unbroken strings and long sentences) inside the
      dialog; shadcn `Table` primitive untouched, `Textarea` primitive change is the intended fix.
- [x] Info block reads director → title → tagline → badges → genres → synopsis → cast → studio →
      budget/revenue.

---

## Page — For You (recommendations) ✅ implemented 2026-06-29 (pending review)

Implemented 2026-06-29. **Pure chrome** — no backend, no data changes. The three owner-reported
drifts are fixed by extending the shared `EditorialMasthead` (not forking it) and merging the split
section head into one. `pnpm typecheck`, `pnpm lint`, `pnpm test` (527, unchanged — the changed
components are presentational) all green. Headless smoke: section order intact, 0px overflow at
375/768/1280/1920, 0 console errors; section titles render at 36px Instrument Serif with the rule
below; tools-card border is now marquee-amber (oklch hue 68), not indigo. **Database + not-found
mastheads verified unregressed** (still `divider="top"`: rule on the inner eyebrow row, header
itself unruled, title centered).

### What shipped

- **Header (owner #1)** — `EditorialMasthead` gained a `divider?: "top" | "bottom"` prop. `top`
  (default) keeps the Database/not-found shape (rule under the eyebrow). `bottom` (For You) leaves
  the eyebrow unruled and rules the whole header at its base, and floats `actions` top-right
  (absolute) so the centered title stays centered — matching the kit's `.cdb-fy-header` +
  `.cdb-fy-actions`. For You now passes `align="center" divider="bottom"`.
- **Tools card (owner #2)** — `RecommendationToolsCard` swapped
  `border-indigo-500/20 bg-gradient...from-indigo-500/5` for the kit's `.cdb-rt-card`: a
  `marquee 22%`-mixed border and a soft radial amber wash off the top-left, layered as a `before`
  overlay so the card keeps its `bg-card` (`--bg-elev-1`) base + light-mode override. `Tabs` got
  `relative` so its content sits above the wash. Active tab already reads amber via `--primary`.
- **Section heads (owner #3)** — merged the split head into one. `NumberedSection` now renders the
  full kit head: mono-11px-uppercase `--fg-dim` number → serif-36px white title → serif-italic-14px
  muted lede stacked on the left, aside (friend stack / source + the per-section refresh) on the
  right, `border-b` below. It took `title`/`description`/`onRefresh`/`isRefreshing` props up from
  `RecommendationSection`, which is now body-only (poster row, dismiss, empty/loading, and the
  below-row "See all" expand/collapse — kept per judgment call A). The `border-l-4` colored accent
  bar (no kit equivalent) was dropped. Section-to-section gap bumped to `space-y-12` (kit's 48px).

### Judgment calls — RESOLVED with the owner (2026-06-29)

Audited against `CDb Design System/ui_kits/web/ForYou.jsx` + `ForYouTools.jsx` + `kit.css`
(`cdb-fy-header*`, `cdb-fy-title`, `cdb-fy-lede`, `cdb-fy-section*`, `cdb-rt-card`/`-tabs`/`-tab`).
Current: `src/app/(main)/recommendations/page.tsx` +
`src/components/editorial/editorial-masthead.tsx`,
`src/components/recommendations/numbered-section.tsx`, `recommendation-section.tsx`,
`recommendation-tools-card.tsx`.

**Low-to-moderate drift.** Phase 7 brought the editorial masthead here, and the page order already
matches the kit (header → tools card → similar results → conversational filters → sections). The
remaining gap is **three chrome mismatches the owner already spotted**, all caused by the page being
fitted to the _Database_-shaped shared masthead and a split section head, not the _For You_ layout:

### Owner-reported drift (confirmed against the kit)

1. **Header is left-aligned with the rule above the title; kit centers it with the rule below.** The
   kit's `cdb-fy-header` is a single column — eyebrow + **centered** serif title
   (`text-align:center`) + **centered** italic lede (`margin:0 auto`) — with **one rule at the
   bottom of the whole header** (`border-bottom` on `.cdb-fy-header`, `padding-bottom:24px`). The
   eyebrow has **no** rule of its own. Ours renders `EditorialMasthead` with `align="left"`, which
   (a) left-aligns the title + lede and (b) puts the rule **under the eyebrow, above the title**
   (the Database shape). This is a genuine structural difference: For You ≠ Database header. The
   Database masthead keeps its own shape (issue line + date with a rule under it, then centered
   title); For You needs the rule moved to the bottom and the title/lede centered. **The actions
   (Dismissed / Refresh all) stay top-right**, kit-faithful (`.cdb-fy-actions` is
   `position:absolute; top:16px; right:0`).

2. **Tools card has the wrong accent — purple/blue, kit is gold.** Current `RecommendationToolsCard`
   uses `border-indigo-500/20 bg-gradient-to-br from-indigo-500/5`. The kit's `.cdb-rt-card` is a
   **marquee/amber** card: `border: marquee 22% over --border`, a
   `radial-gradient(... marquee 7% ...)` top-left wash over `--bg-elev-1`, `radius-xl`. Swap the
   indigo for the marquee tint. (The "a bit longer" the owner saw is incidental padding/border
   extent; the tint is the real item.) Active tab also tints `--cdb-marquee` (`.cdb-rt-tab.active`)
   — the shadcn `TabsTrigger` already uses the primary/amber active state, so confirm at build, no
   churn if it already reads amber.

3. **Section heads: number + title too small, rule on the wrong side, and the head is split.** Kit
   `.cdb-fy-section-head` is **one** flex row (`space-between`, `align-items:flex-end`) with a
   **`border-bottom`** (rule _below_ the head). Its left column **stacks**: `.cdb-fy-section-num`
   (mono **11px**, `letter-spacing .16em`, **uppercase**, `--fg-dim`) → `.cdb-fy-section-title`
   (serif **36px**, default white fg) → `.cdb-fy-section-lede` (serif italic 14px muted). The right
   column is the aside (friend stack / source · refresh · See all). Ours splits this across **two**
   components: `NumberedSection` renders only the marker (serif **24px**, `--fg-dim`) + aside with a
   **`border-t`** (rule _above_), and `RecommendationSection` separately renders a `border-l-4`
   colored accent bar + sans-serif **18px** semibold title + sans description + a refresh button.
   Net: marker should be mono-11px-uppercase not serif-24px; title should be serif-36px-white not
   sans-18px; rule moves from top to bottom; the `border-l-4` accent bar (no kit equivalent) is
   dropped; num/title/lede stack in one head with the aside beside them.

### Review (manual + feature-dev code-reviewer, 2026-06-29)

- **Mobile actions overlap (caught in self-review + reviewer).** The kit makes `.cdb-fy-actions`
  `position: static` under its 900px media query so the buttons can't overlap the centered title on
  phones. Replicated: the floating actions are `min-[900px]:absolute` (drawer breakpoint) and sit in
  normal flow above the eyebrow below it. Verified at 390px (clean stacked row, 0px overflow) and in
  the 920–1024px band (title sits in a vertical band _below_ the top-floated actions, so even where
  their x-ranges intersect the y-ranges don't — measured, no overlap). No title padding needed.
- **Refresh `sr-only` now reflects state.** The refresh button moved into `NumberedSection`; its
  `sr-only` label now reads "Refreshing {title}" while spinning (was static "Refresh {title}" in
  both this and the old code — pre-existing, fixed now that it's centralized).
- **Reviewer confirmed non-issues:** `divider="top"` default preserves Database/not-found (verified
  headless too); no stale props on `RecommendationSection`; the tools-card `before` wash is
  `pointer-events-none` (no click-swallow); conventions clean (no `any`/`prev`/em-dashes, named
  exports, double quotes). No Critical or remaining Important findings.

### Owner follow-ups (second visual pass, 2026-06-29)

- **Tools-card tabs → gold text, softer active chip (kit `.cdb-rt-tab`).** The shadcn `TabsTrigger`
  tinted the active tab white and drew a bordered, shadowed chip (the "strong ring"). Override via
  `className` only (primitive untouched): active text → `text-cdb-marquee-text` (gold, light+dark),
  active border → transparent, active shadow → none. Verified: active color is warm gold
  (`lab(73 23 59)`), inactive neutral gray; border + shadow gone; gold follows the selected tab.
- **Filtered-results section (non-kit improvement).** When filters are active the page collapses to
  a single "Filtered Results" section. Three tweaks: (1) **show all results instantly** — new
  `showAll` prop on `RecommendationSection` renders every item up front; (2) **drop the "See all" /
  "Show less" toggle** when `showAll` (the filter sentence is already the expand gesture); (3) **add
  a refresh** — new `useRefreshFilteredRecommendations(filters)` hook revalidates the filtered SWR
  key (the filtered grid is a live server query, so there's no cached `refresh` endpoint to hit),
  wired to the section head's refresh button. Verified: 20 items shown, no toggle, refresh present
  ("Refresh Filtered Results"), other sections correctly replaced, 0 console errors.

### Judgment calls — RESOLVED with the owner (2026-06-29)

- **A. "See all" placement → KEEP below-row toggle.** Owner chose to keep our centered "See all N
  more" / "Show less" expand/collapse below the poster row (it does real work the kit's no-op
  decoration doesn't). The section head therefore carries only number/title/lede + aside (friend
  stack / source · refresh); **no** "See all" in the head.
- **Header scope → EXTEND the shared masthead.** Add a minimal mode to `EditorialMasthead` (centered
  title + lede with the divider at the **bottom** of the header, actions still top-right) rather
  than forking a For-You-only header. Must not regress Database (rule under eyebrow, centered title,
  no actions) or not-found.
- **B. Section title casing.** Our titles are sentence-ish phrases ("Based on your taste", "Similar
  tastes in the group"). At serif 36px they read as editorial headlines — fine as-is. No change
  unless the owner wants Title Case.
- **C. The `★` marker for Similar Titles.** Kit uses a literal `★` glyph as the section "number" for
  the Similar Titles results block. Keep (it already does this); it just needs the mono-uppercase
  treatment like the numbers, or stay as a serif star — minor, will pick the one that reads cleaner.

### Kit section order (target) — already matches

1. Editorial header (centered, rule below) + top-right actions
2. Tools card (Predict My Rating / Find Similar tabs) — amber-tinted
3. Similar Titles results (only after a search) — `★` head
4. Conversational filters ("Show me … from the …")
5. Recommendation sections (numbered 01–04, serif heads, rule below each)
6. Warming-up state replaces 2–5 for new users (not-personalized)

### Current order (live)

`EditorialMasthead → WarmingUpBanner? → RecommendationToolsCard → (Similar NumberedSection)? → ConversationalFilters → sections.map(NumberedSection)`
— **order already correct**; only chrome drifts.

### Drift checklist

- [x] **Header — center + rule below (owner #1).** Extended `EditorialMasthead` with `divider`; For
      You uses `align="center" divider="bottom"`, actions float top-right. Database/not-found
      unregressed (verified headless).
- [x] **Tools card — marquee/amber tint (owner #2).** Marquee border + radial amber `before` wash
      over `bg-card`. Active tab amber via `--primary`.
- [x] **Section head — mono-uppercase number, serif-36 white title, rule below, single head (owner
      #3).** Merged into `NumberedSection`; `border-l-4` accent dropped; body kept in
      `RecommendationSection`.
- [x] **See all placement (judgment call A).** Kept below-row expand/collapse per owner's answer.

### Keep as-is (flagged, not matching the kit literally)

- **Tools card internals** (Predict My Rating result card, Find Similar chips) already match the
  kit's `ForYouTools.jsx` structurally — only the **card shell tint** drifts. No internal rework.
- **Conversational filters** already use the shared `ConversationalFilters` (kit-faithful). No
  change.
- **Real expand/collapse on "See all"** does work the kit's decoration doesn't — keep the behavior
  regardless of where the control sits.
- **Warming-up state** (`WarmingUpBanner`) — out of scope for this pass unless drift surfaces; owner
  said they've only looked at the personalized state. Audit it before assuming it matches.

### Net new backend work for this page

- **None expected.** This is pure chrome (alignment, tint, section-head typography). All data
  already flows. Flag if a head rebuild needs a count we don't have (not anticipated).

### Acceptance (For You)

- [x] `pnpm typecheck && pnpm lint && pnpm test` (527) pass.
- [x] Header: centered serif title + centered italic lede, single rule at the bottom of the header,
      actions still top-right. Database + not-found mastheads visually unchanged (Database verified
      headless: `divider=top` shape intact, title centered, "The collection").
- [x] Tools card reads amber/marquee (border hue 68 + top-left wash), not indigo; active tab amber.
- [x] Section heads: mono-uppercase number, serif-36 white title, italic muted lede, rule below the
      head, no colored left bar; poster row + dismiss + refresh + expand all still work.
- [ ] Light mode readable, no broken contrast, no missing tokens. **(owner visual pass)**
- [x] No regression on Database / not-found mastheads (smoke check). Overflow 0px at 375–1920.

---

## Page — Users + User Profile ✅ implemented 2026-06-30 (pending review)

Audited + implemented 2026-06-30. **Low drift, as predicted.** Backend slice is TDD (6 new tests in
`tests/lib/users/roster-lede.test.ts`). `pnpm typecheck`, `pnpm lint`, `pnpm test` (**533**) all
green. Headless smoke (tester login, 1280px): roster + admin profile both **0px overflow, 0 console
errors**; roster lede renders "8 regulars · 80 weeks in, one Sunday slot." on real data; profile
shows the gold-active tab, serif/amber stat tiles, and the 4-up pick grid with W/L badges (City of
God 7.6 → W, Hard Candy 3.1 → L). Owner does the real visual pass.

**What shipped:**

- **No new DB query.** The roster lede's "N weeks in" reads the _existing_ `weeksSinceFirstSession`
  from `/api/stats` (same aggregate driving the Database masthead) via `useDashboardStats()`. The
  only new logic is a pure `buildRosterLede({ memberCount, weeksActive })` helper
  (`src/lib/users/roster-lede.ts`, TDD): pluralizes regulars/weeks, drops the weeks clause when null
  (pre-first-session), and falls back to the evergreen line when `memberCount <= 0` (also the
  loading state, since `memberCount` derives from `users?.length ?? 0`).
- **`weeksActive` threaded** through `UsersPage → RosterContent → RosterWithPresence → RosterShell`
  as a plain prop (null until dashboard stats land; lede degrades gracefully, no flicker to wrong
  numbers — it goes evergreen → full, never wrong→right).
- **Profile tab bar** restyled to the kit's gold-active soft-chip via a `PROFILE_TAB_CLASS`
  className (the For You `TOOLS_TAB_CLASS` pattern verbatim); shadcn `Tabs` primitive untouched.
- **Profile stat tiles** rebuilt to `cdb-up-stat-card`: uppercase mono micro-label + quiet `fg-dim`
  icon head row, **display-serif 32px** value, **Avg-rating tile tinted amber** via an `accent`
  flag. Dropped the old `CardHeader/Content/Title` chrome (and trimmed those imports).
- **Recent picks** rebuilt from the 2-up card list to the kit's **4-up editorial poster grid**
  (`grid-cols-2 lg:grid-cols-4`): full 2:3 poster, numbered serif title (`01`…), `type · year` meta,
  `★ avg /10 group avg` line, **plus the kept W/L badge** (avg ≥ 7 = W). Collapsed to one 4-up row
  (`COLLAPSED_COUNT`) with a "See all N more" / "Show less" toggle (see owner follow-up below — the
  initial hard cap was replaced). Added `media.release_year` to the recentPicks query (select +
  groupBy) and the `RecentPick` type to feed the year in the meta.

### Surface A — Users roster ("The Cast")

**Two surfaces, both editorial.** Audited against `Users.jsx` + `UserProfile.jsx` /
`UserProfileTabs.jsx` and `kit.css` (`cdb-us-*`, `cdb-up-*`). Headline finding: **low drift
overall.** The first rollout (Phase 7/8) already shipped the credits-page roster, the
`MagazineCoverHeader`, the stat tiles, and the Stats / Games / Watchlist panes — all of those
already match the kit structurally. The remaining gap is concentrated in **two spots on the
profile's Overview tab** plus the **tab bar chrome**, and one **mock-data line** on the roster. No
section needs reordering; no pane needs rebuilding.

Current files: `src/app/(main)/users/page.tsx` (roster), `src/app/(main)/users/[id]/page.tsx`
(profile) + `src/components/users/*`, `src/components/stats/*`, `src/components/watchlist/*`.

### Review (feature-dev code-reviewer + manual, 2026-06-30)

No Critical findings. Two Important findings, both reconciled:

- **Recent-picks header count over-counted (conf 88).** The header showed `picks.length` (the API's
  `.limit(20)`) while the grid renders only `MAX_PICKS` (4) — "Recent picks (20)" above 4 cards.
  **Fixed**, kit-faithfully: dropped the parenthetical count entirely (the kit's header is just
  "Recent picks", no count). A `(4)` would have been redundant; a `(20)` misleading.
- **Roster lede flicker (conf 80).** `users` and `dashboardStats` are independent SWR reads, so the
  lede can render "N regulars, one Sunday slot." then update to add "· W weeks in" when stats land.
  **Left as-is (accepted):** it's the documented Database-masthead pattern (`buildFootnote` does the
  same), and it only ever goes evergreen → partial → full — **never shows a wrong number**, just a
  less-complete sentence. Co-locating the read to defer the lede would trade the flicker for a
  _missing_ lede, which is worse in the hero position.

Everything else the reviewer checked (SQL group-by correctness, `Number()`-wrapping, the
`avg_score`/`rating_count` null guard, Readonly props, `String()` in JSX, named exports, the
`PickCard` key, the `authReady` presence guard) came back clean.

### Owner follow-ups (second visual pass, 2026-06-30)

Three adjustments after the owner's first look, all verified headless (admin profile, 0px overflow):

1. **Warmer profile backdrop.** The kit's profile scrim sits over a browner near-black
   (`rgba(15,11,10)`) than our neutral `--bg` (`oklch(0.13 0.008 60)` — warm hue but ~0 chroma).
   Added a faint amber wash to `MagazineCoverBackdrop`
   (`bg-gradient-to-b from-[color-mix(in_oklch,var(--cdb-marquee)_9%,transparent)] to-transparent`,
   strongest at top, fading down) to recover the magazine-cover warmth. Stays on-token (light-mode
   safe). **Scope-safe:** `MagazineCoverBackdrop` is consumed only by the profile page — no other
   screen uses it, so no shared-primitive regression.
2. **Tab bar is content-width, not full-width.** The shadcn `TabsList` is `w-fit`, but the `Tabs`
   root is a flex column that stretched it to full width. Added `self-start` (the kit's
   `align-self: flex-start`) so the bar hugs its tabs, left-aligned — matching `cdb-up-tabs`.
3. **Recent picks → show more/less, not a hard cap.** Replaced the 4-cap with the For You section's
   expand pattern: collapsed shows one 4-up row, a centered ghost toggle reads "See all N more" /
   "Show less" (`COLLAPSED_COUNT = 4`). Verified: admin (20 picks) → "See all 16 more" → expands to
   all 20 → "Show less". Animation stagger capped (`Math.min(index, COLLAPSED_COUNT)`) so a 20-pick
   expand doesn't trail in over a second.

### Surface A — Users roster ("The Cast")

Already a faithful match: editorial header (eyebrow · N members → serif "The _cast_" → italic lede),
`IssueLine`, numbered rows (rank · avatar+presence dot · name+role+tagline+handle ·
Picks/Watched/Avg stats · arrow). Tokens, fonts, ratios, hover all line up with `cdb-us-*`.

#### Drift checklist (roster)

- [x] **Lede subtext is hardcoded mock copy.** Live read
      `"Everyone who shows up for the group's screening room."` (kit mocks
      `"Five regulars, one Sunday slot, 23 weeks in."`). **DONE** — now data-driven via
      `buildRosterLede` ("N regulars · K weeks in, one Sunday slot."), reusing the existing
      `weeksSinceFirstSession` aggregate. Evergreen line kept as the empty/loading fallback.
- [ ] **`IssueLine` date is `MMMM YYYY` via `formatIssueDate`; kit shows roman-numeral month**
      (`Roster · May MMMM`). This is the same issue-line primitive used app-wide; **keep as-is**
      (the roman-numeral month is a kit affectation we standardized away from — flagging, not
      changing).

### Surface B — User profile

Header (`MagazineCoverHeader` + `MagazineCoverBackdrop`), the 4 stat tiles, and the Stats / Games /
Watchlist tab panes all already match `cdb-up-*` / the `UserProfileTabs.jsx` recreations (the kit
file literally annotates those panes as "faithful to the real app surfaces"). Confirmed component by
component. The drift is the **Overview tab** and the **tab bar**.

#### Kit section order (target) — already matches

1. Back-to-cast link
2. Magazine-cover header (roster #, credit, avatar+presence, serif name, role badge, italic tagline,
   meta)
3. 4 stat tiles (Sessions / Avg rating / Picks / Ratings)
4. Tab bar (Overview / Stats / Games / Watchlist)
5. Overview: **Rating distribution** card, then **Recent picks** card

#### Current order (live) — same as target

`Back → MagazineCoverHeader → 4 StatCards → Tabs[Overview|Stats|Games|Watchlist]`, Overview =
`RatingDistribution → RecentPicks`. **No reordering needed.**

#### Drift checklist (profile)

- [x] **Tab bar uses default shadcn `TabsList` chrome (white-active, bordered/shadowed chip).**
      **DONE** — `PROFILE_TAB_CLASS` (the For You `TOOLS_TAB_CLASS` pattern) applied to all four
      triggers via `className`; primitive untouched. Verified headless: Overview tab renders amber.

- [x] **Recent picks: wrong layout.** **DONE** — rebuilt to the kit's 4-up editorial poster grid
      (full 2:3 poster, numbered serif title, type · year meta, `★ avg /10 group avg`). **W/L badge
      kept** (owner decision). `avgScore` → the group-avg line + the W badge; `release_year` added
      to the API for the year.

- [x] **Recent picks count.** **DONE** — `grid-cols-2 lg:grid-cols-4` (2-up narrow, 4-up wide).
      Initially a hard 4-cap; the owner-follow-up pass replaced it with a collapse-to-one-row + "See
      all N more" toggle (`COLLAPSED_COUNT`). API returns up to 20.

- [ ] **Rating distribution card chrome (minor).** Live bars are interactive (click to expand a
      per-score rated-titles list) — a **real feature the kit doesn't have** and we keep. Structure
      (10 cols, count above, axis below, avg bar amber) already matches. Only token nits: kit fill
      for the avg column is `var(--cdb-marquee)` and others `var(--bg-elev-3)`; live uses
      `bg-primary` (= marquee) for avg and `bg-[var(--bg-elev-3)]` otherwise — **already matches.**
      The header "N ratings · avg X.X" matches. → **Keep as-is**; the expand interaction is an
      intentional improvement over the kit.

- [x] **Stat tiles — confirm chrome.** **DONE** — matched the kit (owner decision): uppercase mono
      micro-label + quiet `fg-dim` icon head row, **display-serif 32px** value, **Avg-rating tile
      tinted amber** via `accent`. Old `CardHeader/Content/Title` chrome dropped.

### Keep as-is (flagged, not matching the kit literally)

- **Roster `IssueLine` month format** — roman-numeral month is a kit affectation; we standardized on
  `MMMM YYYY`. Not changing.
- **Rating-distribution click-to-expand** — a real feature beyond the kit; keep it.
- **Profile tagline source** — kit hardcodes `USER_TAGLINES`; live reads the real `tagline` column
  (already wired). No change.

### Net new backend work for this page

- **No new query.** The roster's "weeks in" reuses the existing `/api/stats`
  `weeksSinceFirstSession`. The only schema-touching change was additive: `media.release_year` added
  to the existing `recentPicks` select/groupBy (+ the `RecentPick` type) so the pick card can show
  the year. No migration.

### Judgment calls — RESOLVED with the owner (2026-06-30)

1. **Roster lede → wire to real data.** Render "N regulars · K weeks in" style copy from real
   aggregates (member count is already real; add a cheap `MIN(date_watched)` →
   weeks-since-first-session). Keep the editorial cadence ("one Sunday slot") around the live
   numbers; sentence case, `·` separator, no em-dash.
2. **Recent-picks W/L badge → keep it.** Rebuild to the kit's 4-up editorial poster grid but retain
   our real W/L chip near the rating (pick rated ≥7 group avg = W). Tasteful, small; substance over
   pure kit fidelity.
3. **Profile stat tiles → match the kit.** Display-serif 32px value, Avg-rating tile tinted amber.
   (Diverges from the homepage strip, which stayed sans — but this is the profile's own tile
   treatment and the owner wants the editorial serif here.)

### Acceptance (Users + Profile)

- [x] `pnpm typecheck && pnpm lint && pnpm test` (**533**) pass.
- [x] Roster lede data-driven ("8 regulars · 80 weeks in, one Sunday slot."); member count stays
      real; evergreen fallback for empty/loading.
- [x] Profile tab bar is the gold-active soft-chip control (For You pattern), primitive untouched.
- [x] Recent picks is the 4-up editorial poster grid (numbered serif title, type·year, group-avg
      rating + kept W/L badge), `grid-cols-2 lg:grid-cols-4`, with a show more/less toggle
      (collapsed to one row, "See all N more" → "Show less").
- [x] Stat tiles match the kit (serif value, amber Avg).
- [x] Rating-distribution expand interaction still works (verified headless: 5 `/database/` links =
      4 picks + 1 dist-expand link).
- [ ] Light mode readable, no broken tokens. **(owner visual pass)**
- [x] No regression on the roster or other editorial surfaces (smoke check: roster + profile 0px
      overflow, 0 console errors).

### Second-pass owner asks (2026-06-30, third visual pass) — ✅ implemented (pending review)

Implemented 2026-06-30/07-01. `pnpm typecheck`, `pnpm lint`, `pnpm test` (533) all green. **Summary
of what shipped** (details per item below):

- **Games (1):** `year_guess` wired through the type (`UserGameStatsResponse.yearGuess`) + the
  `/api/users/[id]/games/stats` route (partition + `buildGameTypeStats`) — additive, no migration.
  `UserGameStats` rewritten: each game is now a `Card` (`bg-elev-1`, kit's `cdb-game-section`) with
  an icon-tinted header, hero row, and **inline** sub-heads (Ranked best scores / Game details /
  Recent games) — no more accordions. Per-game icon tint (poster→amber, rating→rose, year→tv-cyan;
  cherry stays reserved for live MP). **Game details kept** (Rounds/Games Won) as an inline block.
  **Recent games** collapses to 3 with a "See all N more" / "Show less" toggle. year_guess's recent
  subtitle uses the existing "X/Y correct" branch (accuracy-scored).
- **Watchlist (2):** prediction moved from the top outline `<Badge>` to the kit's `cdb-wl-pred`
  footer text (`★ score predicted`, amber star + bold score + `fg-dim` caption), bottom-right of the
  content column. Tooltip (verdict + confidence) kept on hover. Dropped `getPredictionColor` +
  `Badge`/`SparklesIcon` imports.
- **Role badge (3):** `ProfileRoleBadge` is now the kit's amber pill (`cdb-up-role-badge`: marquee
  16% bg, 32% border, marquee text, rounded-full), shared `ROLE_PILL_CLASS` for Admin + Mod.
- **Tagline (4):** `MagazineCoverHeader` wraps the tagline in curly quotes (`&ldquo;…&rdquo;`).
  Scope-safe — that primitive renders only on the profile page.

#### Review (feature-dev + manual, 2026-07-01)

One Critical + one Important, both fixed and re-verified:

- **Global rank was corrupt (Critical, conf 95).** `buildGameTypeStats` did `rankResult.count + 1`
  where `count` came from `countAll<number>()` — a compile-time cast over a value Neon returns as a
  **string**, so `"1" + 1` concatenated to `"11"`. **Pre-existing** (poster/rating already shipped
  it), but my change amplified it to 3 games and it violates CLAUDE.md's "`Number()`-wrap
  `countAll()`" rule. Verified live against admin: API returned `globalRankNormal: '01'`,
  `globalRankHard: '11'`. **Fixed** by typing the query `countAll<string>()` (matches runtime;
  `no-unnecessary-type-conversion` would flag `Number()` over a `<number>` cast) + wrapping with
  `Number()`. Re-verified live: ranks now `1` and `2` (integers).
- **Skeleton showed 2 cards for a 3-card tab (Important, conf 85).** `GameStatsSkeleton` looped
  `length: 2`; bumped to 3 to match the three game cards (no load-time layout snap).

Everything else the reviewer checked came back clean: `GAME_TONE` exhaustiveness (typed
`Record<GameType, string>`), the `RecentGamesList` toggle logic + delay cap, the watchlist `mt-auto`
footer layout (incl. no-prediction cards), `hasAnyGames` including `yearGuess`, the year_guess API
partition, all removed imports (`getPredictionColor`/`Badge`/`SparklesIcon` gone, `StatsSection`
still used by the Stats tab), the `ROLE_PILL_CLASS` refactor, and the tagline entities.

#### Audit (kept for reference)

Four more kit differences the owner wants adopted after living with the first pass. Audited against
`UserProfileTabs.jsx` (`GamesPane`, `WatchlistPane`) + `UserProfile.jsx` and `kit.css`.

**1. Games tab — restructure to one card per game + add the missing Year Guesser.**

- **Current:** `UserGameStats` renders only `posterReveal` + `ratingGuess`, each as a header + hero
  row + **three collapsible `StatsSection` accordions** (Ranked Best Scores / Game Details / Recent
  Games). **`year_guess` is missing end-to-end** — not in `UserGameStatsResponse`, not in the API
  route, not rendered.
- **Kit:** each game is one `cdb-game-section` card — icon-tinted header, hero-stats row, a "Ranked
  best scores" sub-head + grid, and a "Recent games" sub-head + list, **all inline** (no
  accordions). The kit omits the "Game Details" (Rounds Won / Games Won) block.
- **Target (owner):** **three** big cards (Poster Reveal, Rating Guesser, **Year Guesser**), each
  with inline sections like the kit — but **keep our Game Details stats** (the kit dropped them; we
  don't want to lose them). So: wire year_guess through the type + API + UI, wrap each game in a
  `Card`, and de-accordion the sections (Ranked Best Scores + Game Details + Recent Games all
  inline). year_guess's "Recent games" subtitle falls into the existing "X/Y correct" branch (it's
  accuracy-scored with `is_correct` per round) — no special-casing needed.
- **Backend:** additive, no migration. `game_leaderboard` + `game_sessions` already carry year_guess
  rows; the route just doesn't partition/build them. Add
  `buildGameTypeStats(userId, "year_guess", …)` + a `yearGuessRecent` partition + `yearGuess` on the
  response, and `yearGuess: GameTypeStats | null` on the type. `getClientGameConfig` already has the
  Year Guesser config (calendar icon, `/play/year-guess`).
- **Open judgment calls (below):** do Recent Games / Game Details stay collapsible or go inline?

**2. Watchlist card — prediction as kit's footer text, not our badge.**

- **Current:** `WatchlistCard` shows the prediction as an outline `<Badge>` (sparkles icon + score,
  color-tiered) in the **top meta row**, with a tooltip (verdict + confidence).
- **Kit:** `cdb-wl-pred` is a **bottom-right footer** treatment — `★ 7.4 predicted` (star, score
  size-13 bold, tiny "predicted" caption in `fg-dim`), opposite the status pill in a
  `cdb-wl-card-foot` row.
- **Target:** move the prediction to a kit-style footer text (star + score + "predicted"). Owner
  said the other watchlist-card differences are **not** in scope — only the prediction treatment.
- **Decision needed:** keep the tooltip (verdict/confidence) on the new footer text, or drop it? The
  kit has no tooltip; the data is useful. Leaning keep-on-hover.

**3. Role badge — pill around "icon + Admin/Mod" at the top of the profile.**

- **Current:** `ProfileRoleBadge` is plain muted text (`ShieldIcon` + "Admin"), no chrome.
- **Kit:** `cdb-up-role-badge` is an amber pill — `color-mix(marquee 16%)` bg, `marquee 32%` border,
  marquee text, `rounded-full`, `4px 11px` padding. Small change, header only.

**4. Tagline — curly quotes around the user's custom quote.**

- **Current:** `MagazineCoverHeader` renders the tagline bare (italic serif, no quotes).
- **Kit:** wraps it in curly quotes (`&ldquo;…&rdquo;`). Small. **Note:** `MagazineCoverHeader` is a
  shared primitive — but it's consumed only by the profile page (confirmed), so quoting the tagline
  there is scope-safe. (If the roster's inline tagline should also get quotes for consistency, flag
  — the roster tagline is a different element, currently unquoted.)

#### Judgment calls — RESOLVED with the owner (2026-06-30)

1. **Recent Games → inline + show-more.** Kit's inline look, but collapsed to ~3 rows with a "See
   all N more" / "Show less" toggle per game (the RecentPicks/For You pattern) so 3 active games
   don't make a wall of rows.
2. **Game Details → inline sub-section.** Keep Rounds Won / Games Won (kit dropped them) as an
   always-visible inline block, matching the kit's all-inline card rhythm.
3. **Watchlist prediction → keep the tooltip.** New kit-style footer text (`★ score predicted`), but
   hover still reveals verdict + confidence.

---

## Page — Settings ✅ implemented 2026-07-01 (pending review)

Audited 2026-07-01 against `Settings.jsx` + `kit.css` (`cdb-st-*` — **not** `cdb-set-*`). **Lowest
drift of any page so far.** The current `src/app/(main)/settings/page.tsx` (single file) already
implemented the kit's magazine layout end to end: editorial header (eyebrow → serif "The _fine
print_" → italic lede → avatar with "Change" affordance), sticky left rail
(`Profile / Password / Notifications`, gold-active soft-chip with the left accent bar), and the
three utility panes on the right, each with the shared `PaneHead` chrome. This predates the
second-pass rollout — it looks like Settings got the kit treatment already, just never got added to
the spec. The only real gap — Profile pane missing a Discard action — was closed this session.
`pnpm typecheck` / `pnpm lint` / `pnpm test` (533) all green; headless smoke (tester login, 1280px):
Discard button present, clicking it reverts an edited field to the last-saved value, 0px overflow,
no console errors on `/settings`. Owner does the real visual pass.

Current file: `src/app/(main)/settings/page.tsx` (also touches `src/hooks/use-settings.ts`,
`src/hooks/use-notifications.ts`).

### Kit section order (target)

1. Editorial header: eyebrow (`Account · {name}`) → serif title "The _fine print_" → italic lede →
   avatar (88px) with "Change" pill overlay
2. Sticky rail (200px): Profile / Password / Notifications + divider + Log out
3. Content pane, per section:
   - **Profile:** pane head → Display name / Username / Email / Avatar URL fields (460px max) →
     **Save changes + Discard** actions
   - **Password:** pane head → Current password → divider → New password / Confirm → Change password
     action
   - **Notifications:** pane head → row list (label + description + switch), no dividers on the last
     row

### Current order (live) — matches

Same header → rail → pane structure, same field order in all three panes, same 460px field cap, same
divider placement in Password, same row-list shape in Notifications. No reordering needed.

### Drift checklist

- [ ] **Rail icons differ from the kit.** Kit: `UserPlus` (profile), `Settings` (password), `Bell`
      (notifications), `X` (logout). Live: `UserIcon`, `KeyIcon`, `BellIcon`, `LogOutIcon`. **Owner
      call: keep the current icons** — `KeyIcon`/`LogOutIcon` read clearer for their actions than
      the kit's literal picks. Documenting as an intentional deviation, not fixing.
- [x] **Profile pane is missing the kit's "Discard" button.** Kit's `cdb-st-actions` row has
      `Save changes` (primary) + `Discard` (ghost). Live only rendered `Save Changes` — no way to
      revert in-progress edits back to the last-saved values without navigating away and back.
      **DONE** — added a ghost "Discard" button next to Save that resets `displayName` / `username`
      / `email` / `avatarUrl` back to the current `user` prop's values.
- [x] Header eyebrow/title/lede/avatar structure — matches (`Account · {name}`, "The _fine print_",
      italic lede, 88px avatar, Change pill).
- [x] Rail: sticky, 200px, gold-active + left accent bar, divider before Log out — matches.
- [x] Pane head chrome (serif 28px title + muted sub, border-bottom) — matches `cdb-st-pane-head`
      exactly, shared via the local `PaneHead` component.
- [x] Field layout (460px max-width, 18px gap, label-above-input) — matches `cdb-st-fields` /
      `cdb-st-field` exactly, including the divider before "New password" in the Password pane.
- [x] Notification rows (label + description + switch, border-bottom except last row) — matches
      `cdb-st-notif-row`; shadcn `Switch` used in place of the kit's custom `cdb-st-switch` (same
      established primitive-swap pattern as elsewhere).
- [x] Password pane's masked-dots `defaultValue` in the kit is mock-data only (fake pre-filled
      password) — correctly not replicated; live starts empty, which is the only correct behavior.

### Judgment call — Discard button (RESOLVED with the owner 2026-07-01)

**Add it** (matches kit exactly): a ghost "Discard" button next to Save that resets the four fields
back to `user`'s last-saved values. Small, contained change to `ProfileForm` — no touch to
`avatarFocusKey`/focus logic, no new query, no new test needed (plain state reset, no pure logic to
extract).

### Acceptance criteria

- [x] Icon choice and Discard button both explicitly resolved with the owner (this session): keep
      current icons, add Discard.
- [x] `pnpm typecheck` / `pnpm lint` / `pnpm test` stay green (533 tests), manual click-test (edit a
      field, Discard, confirm it reverts) done headless.
- [x] feature-dev code-reviewer pass — clean, no Critical/Important findings. Confirmed no
      stale-closure risk (fresh `user` prop after `mutate`), kit-matching markup, no a11y issue with
      the adjacent submit/button pair. Two sub-80-confidence nitpicks noted and left as-is (stale
      error banner not cleared on discard; Discard not disabled mid-save) — harmless, out of the
      approved scope.
- [ ] Light mode readable, no broken tokens (owner visual pass).

---

## Page — Auth (Login / Signup) ✅ implemented 2026-07-01 (pending review)

Audited 2026-07-01 against `Login.jsx` (single component drives both `mode="login"` and
`mode="signup"`) + `kit.css` (`.cdb-auth-*`, shared `.cdb-eyebrow`/`.cdb-field`). **Low drift**,
same class as Settings — layout, split-screen art panel, field order, and form structure all already
match. The gap here was entirely **copy and micro-spacing**, no structural rework. The art panel
(`AuthArtPanel`) already goes beyond the kit (real top-media posters + live title/friend counts vs.
the kit's static mock list) — that's a deliberate improvement from the first rollout, not drift.
`pnpm typecheck` / `pnpm lint` / `pnpm test` (533) all green; headless smoke (1280px) on both pages:
eyebrow/title gap measured at 8px (matches kit), login title reads "Ready for _another?_" (no more
duplicate "Welcome back"), both submit buttons render the trailing arrow icon, signup switch-link
reads "Have an account? Log in", 0px overflow, no console errors beyond the expected pre-login
`/api/auth/me` 401. Owner does the real visual pass.

Current files: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`,
`src/app/(auth)/_components/auth-art-panel.tsx`.

### Kit section order (target) — already matches

1. Split-screen: art panel (left, desktop only) + form (right)
2. Eyebrow micro-label → serif title (plain + italic-amber accent word) → sub-line
3. Form fields in kit order (signup: invite code → email → username → display name (optional) →
   password + hint; login: email/username → password)
4. Full-width primary submit button
5. Switch-mode link line below the form

### Current order (live) — matches

Same structure on both pages. No reordering needed.

### Drift checklist

- [x] **Eyebrow-to-title gap is looser than the kit.** Root cause found in `kit.css`:
      `.cdb-auth-form` wraps everything in `gap: 16px`, but `.cdb-auth-form .cdb-eyebrow` gets an
      extra `margin-bottom: -8px` — so the eyebrow sits ~8px from the title, not the full 16px. Live
      used a flat `gap-4` (16px) on both pages with no compensating negative margin, so the small
      label sat noticeably farther from the headline than the kit. **DONE** — added `-mb-2`
      (Tailwind for -8px) to the eyebrow `<p>` on both pages; headless-measured gap is now 8px,
      matching.
- [x] **Login page duplicated "Welcome back."** Eyebrow read "Welcome back" and the title also read
      "Welcome _back_" — same phrase twice stacked. Kit's login eyebrow/title pair is "Welcome back"
      (eyebrow) → "Ready for _another?_" (title) — no repeat. **DONE** — swapped the live title to
      "Ready for _another?_" per the kit.
- [x] **Signup page eyebrow-title pair already matched kit copy** ("Sign up" → "Join _the group_") —
      only the spacing item above applied here, not a copy swap.
- [x] **Neither submit button had the kit's trailing arrow.** Kit: both `Log in` and
      `Create account` buttons end with `<I.ArrowRight size={14} />` inside the button
      (`cdb-btn-primary     cdb-btn-lg cdb-btn-block`). Live: plain text, no icon, on both pages.
      **DONE** — added `lucide-react`'s `ArrowRightIcon` after the button label on both submit
      buttons (hidden during the loading state, when the label swaps to "Signing in..."/"Creating
      account...") — already the established icon in this codebase (used in
      Users/Recent-picks/Game-stats trailing-arrow spots).
- [x] **Switch-link copy differed slightly from the kit on both pages** — resolved as a mixed owner
      call, see below.

### Judgment calls — RESOLVED with the owner (2026-07-01)

1. **Switch-link copy — mixed call, not a blanket match-the-kit.**
   - Login bottom link — **keep current wording** ("Have an invite code? Sign up"). Not changing.
   - Signup bottom link — **adopt the kit's copy**: "Already have an account? Log in" → "Have an
     account? Log in".

### Acceptance criteria

- [x] Switch-link copy calls resolved with the owner: keep login's wording, adopt kit's signup
      wording.
- [x] Eyebrow/title spacing tightened to match kit on both login and signup (headless-measured:
      8px).
- [x] Login title swapped to "Ready for _another?_", no duplicate "Welcome back."
- [x] Trailing `ArrowRightIcon` added to both submit buttons.
- [x] Signup switch-link copy shortened to "Have an account? Log in".
- [x] `pnpm typecheck` / `pnpm lint` / `pnpm test` stay green (533 tests).
- [x] Manual click-test both pages (headless smoke, 1280px) + feature-dev review — clean, no
      Critical/Important findings. Confirmed correct conditional icon rendering (no key/fragment
      issue), correct auto-sizing via the `Button` primitive's `size-4` svg rule, no a11y gap (icon
      is decorative, button's accessible name comes from its visible text), no lint gotchas.
- [ ] Light mode readable, no broken tokens (owner visual pass).

---

## Page — Landing ✅ implemented 2026-07-01 (pending review)

Audited 2026-07-01 against `Landing.jsx` + `kit.css` (`.cdb-hero-*`, `.cdb-section*`, `.cdb-btn-*`,
`.cdb-landing-footer`). **Low drift** — hero, feature grid, top-rated row, ticker, and footer
sections all already present in the right order with the right content. The gap was entirely
**sizing/alignment/button-treatment**, no structural or copy rework. Owner did their own visual pass
first and flagged 5 items; all 5 confirmed via headless measurement + screenshot at 1440px before
implementing. `pnpm typecheck` / `pnpm lint` / `pnpm test` (533) all green; headless re-measurement
post-fix: title/first-poster left edges now identical (was 62px apart), wordmark height 324px (was
~148px at this viewport), both buttons 44px tall, Sign up background fully transparent
(`rgba(0,0,0,0)`, was a faint `oklab(...0.054)` tint), footer buttons stacked, 0px overflow. Owner
does the real visual pass.

Current files: `src/app/page.tsx`, `src/app/_landing/hero-section.tsx`,
`src/app/_landing/top-rated-row.tsx`, `src/app/_landing/landing-footer.tsx`,
`src/components/branding/wordmark.tsx`, `src/components/ui/button.tsx` (shared primitive, not
touched — see notes below).

### Kit section order (target) — already matches

1. Hero: poster backdrop → CDb wordmark → tagline → stats line → Log in / Sign up (side by side)
2. Feature grid (Track & rate / Smart picks / Stats & insights / Games)
3. "Top rated by _the group_" + 6-poster row
4. Recent ticker
5. Footer: Log in / Sign up (stacked) + GitHub link + copyright line

### Current order (live) — matches

Same 5 sections, same order. No reordering needed.

### Drift checklist

- [x] **CDb wordmark is smaller than the kit.** Kit's `.cdb-hero-title` is
      `clamp(110px, 15vw,     220px)`. Live's `Wordmark size="lg"` (used only here) was
      `clamp(64px, 12vw, 144px)` — at a 1440px viewport that's 216px (kit) vs. 144px (live), a real
      ~35% gap, not just a rounding difference. **DONE** — bumped the `lg` wordmark size to match
      the kit's clamp exactly. `Wordmark` is a shared component (also used at `xl`/`md`/`sm`
      elsewhere), but `lg` itself is **only consumed by the landing hero** (confirmed via grep) —
      safe to resize without touching other call sites.
- [x] **Hero + footer "Sign up" button reads as a whitish/filled shade, not clear.** Root cause:
      shadcn's `outline` variant (`src/components/ui/button.tsx`) is `bg-background` +
      `dark:bg-input/30` — a faint fill, not `background: transparent` like the kit's
      `.cdb-btn-outline`. **This is the shared Button primitive, used app-wide — not changing the
      global `outline` variant.** **DONE** — scoped `className` override on the two landing "Sign
      up" buttons: `bg-transparent dark:bg-transparent` (both needed — the plain `bg-transparent`
      alone didn't beat the variant's `dark:bg-input/30`, confirmed by computed-style check going
      from a faint `oklab(...0.054)` tint to `rgba(0,0,0,0)` once the dark: override was added too).
- [x] **Both hero + footer buttons are a bit smaller than the kit.** Kit's `.cdb-btn-lg` is
      `height:     44px, padding: 0 22px`. Live's shared `Button` `lg` size was `h-10` (40px) +
      `px-6` (24px) — close but shorter. Same reasoning as above: `size="lg"` is a shared prop used
      elsewhere in the app, so **not resizing the global variant** — **DONE** via scoped
      `className="h-11"` (44px) on the 4 landing buttons (2 hero + 2 footer).
- [x] **"Sign up" button looking slightly bigger than "Log in" is not a deliberate kit size
      difference** — checked `kit.css`: both are `cdb-btn-lg`, same height/padding. The kit's own
      screenshot shows the same natural width difference (longer label + icon). **Left as-is** — no
      fix needed, it's expected content-driven width, not something to force-equalize (owner
      agreed).
- [x] **"Top rated by the group" title doesn't sit above the first poster.** Confirmed via headless
      measurement at 1440px: title's left edge sat **62px left of** the first poster's left edge in
      the same container. Root cause: `top-rated-row.tsx`'s poster row used `sm:justify-center` to
      center the poster group as a unit once it's narrower than the container, while the `<h2>`
      above it stayed left-anchored in the same `mx-auto max-w-5xl` wrapper — the two never shared a
      common left edge once the row didn't fill the container width. Kit's `.cdb-poster-row` is a
      `grid` that always fills the section's full width (`repeat(6, minmax(0,1fr))`), so its first
      cell's left edge is always the section's left edge, same as the title. **DONE** — dropped
      `sm:justify-center` from the poster row (kept `overflow-x-auto` / `sm:overflow-x-visible`).
      Re-measured: title and first poster now share the exact same x-position (0px gap) at 1440px.
- [x] **Footer buttons are side by side; kit stacks them.** Kit's `.cdb-landing-footer` is
      `flex-direction: column` — Log in above Sign up, not side by side (its `.cdb-hero-cta` row, by
      contrast, genuinely is `inline-flex` / side by side — the hero and footer are NOT meant to
      match each other here). Live's `LandingFooter` used `flex gap-3` (row, no direction override).
      **DONE** — added `flex-col` to the footer's button wrapper only (hero stays a row,
      unaffected).

### Judgment calls

None — all 5 owner-flagged items check out against the kit with a clear, scoped fix; no tradeoffs to
weigh. The only editorial note is the "Sign up button looks bigger" item above, which inspection
shows isn't a real kit difference to replicate.

**Reviewed side-effect (not a tradeoff, just documenting):** removing `sm:justify-center` means that
on very wide viewports where the poster row is narrower than the `max-w-5xl` container, the leftover
space now trails on the right instead of splitting both sides. This is exactly the intended behavior
(title and posters must share a left edge, per the kit's grid-fills-width model), confirmed by the
feature-dev reviewer as correctly scoped, not a regression.

### Acceptance criteria

- [x] Wordmark `lg` size bumped to match kit's `clamp(110px, 15vw, 220px)` (landing-only impact,
      confirmed no other call site uses `lg`).
- [x] Hero + footer buttons bumped to `h-11` (44px) via scoped className, not the shared variant.
- [x] "Sign up" buttons (hero + footer) get a `bg-transparent dark:bg-transparent` override so they
      read as a true outline, not a faint fill (both prefixes needed — confirmed via computed
      style).
- [x] "Top rated by the group" title and first poster share a left edge at common viewport widths
      (`sm:justify-center` removed from the poster row; re-measured 0px gap, was 62px).
- [x] Footer's Log in / Sign up stack vertically; hero's stay side by side (unchanged).
- [x] `pnpm typecheck` / `pnpm lint` / `pnpm test` stay green (533 tests).
- [x] Manual click-test (headless smoke, 1440px) + feature-dev review — clean, no Critical/Important
      findings. Confirmed the `sm:justify-center` removal is a correctly-scoped, intended tradeoff
      (not a regression), the `size="lg"` wordmark scope is accurate (only consumer is the landing
      hero), the `dark:bg-transparent` override is the idiomatic fix given tailwind-merge's per-slot
      dedup behavior, and no lint gotchas apply.
- [ ] Light mode readable, no broken tokens (owner visual pass).
