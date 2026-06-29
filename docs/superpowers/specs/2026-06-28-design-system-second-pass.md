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

1. **Home / Dashboard** — audited below. Highest drift.
2. **Database** — audited below. Low drift (Phase 6 shipped masthead/featured/filters/timeline).
3. For You (recommendations) — to audit
4. Users + User Profile — to audit
5. Settings — to audit
6. Auth (login / signup) — to audit
7. Landing — to audit
8. Media detail — to audit
9. Play hub — to audit

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

### ⚠️ Known issue deferred (separate fix, not this commit)

- **List-view horizontal overflow at exactly 1280px (~47px), pre-existing & global.** Confirmed on
  the untouched baseline, so not introduced here. Root cause is **shell geometry**, not the table or
  band: `sidebar (256px) + main (max-w-7xl content + p-6 padding ≈ 1071px) = 1327px`, 47px over a
  1280px viewport. The non-shrinking boundary is the shadcn **`SidebarInset`** primitive
  (`min-width: auto`); `min-w-0` on the inner `<main>` did **not** help (tested). List view exposes
  it because the table fills `main` to full width; grid/timeline content wraps under the threshold.
  Fix belongs at the shell level and touches every page, so it should be its own change with a
  cross-page smoke check — out of scope for the Database card-chrome pass. Affects all routes
  equally.

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
