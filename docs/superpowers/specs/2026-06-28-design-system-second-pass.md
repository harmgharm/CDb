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
9. **Play hub** — ✅ implemented (below). Was the **highest drift since the homepage** — no
   `PageHeader` shell header, no cross-game leaderboard, no live-now list; the game cards had a
   different internal anatomy than the kit's. All closed.
10. **Game play surfaces (solo + multiplayer)** — ✅ implemented (below). Covers all 3 games' solo
    setup + live `[id]` play pages as one unit (the kit itself only distinguishes solo vs.
    multiplayer, not per-game-type, and the 3 games already share components/patterns). Kit:
    `GamePlay.jsx` (solo), `GamePlayMP.jsx` (multiplayer). **Not** the Play hub landing page (done
    above) — this is the per-game play/round UI reached after clicking into a game. Was the
    **highest-drift surface since the homepage/Play hub** — structure already matched the kit
    closely, but zero `cdb-gp-*` design-system tokens were used anywhere; a full re-skin, not a
    small fix. All closed.
11. **Sidebar / Shell** — ✅ implemented 2026-07-07 (below). Kit: `Shell.jsx`. Lowest-drift audit so
    far — section order already matched the kit, `UpNextCard` already exceeded it with real data.
    Closed: brand icon tile, active-item amber tint + left rail, "admin" nav tag, `UpNextCard` card
    chrome + rail + serif title, online users list rebuild (hybrid list+overflow), tagline copy.
    Footer dropdown and sidebar width both kept as-is per owner call. One Critical review finding
    (rail invisible due to button `overflow-hidden`) fixed — see "Review outcome" in the page
    section.
12. **Admin** — ✅ implemented 2026-07-07 (below). Last work-order item. Kit: `Admin.jsx`. Medium
    drift, chrome-heavy: pane structure already matched ~1:1; closed the masthead/issue-line (real
    member + active-code counts), gold tabs, kit table chrome, semantic badge tokens, and
    "Users"→"Members" copy sweep. Zero Critical/Important review findings. Uncommitted, pending
    owner review.

**Added to the work order 2026-07-06** (games 10-12 above) — these three kit screens/surfaces were
previously out of scope (the original 9-page list came from the spec's original page-drift-ranking
pass and didn't include them). Not yet audited; no drift findings recorded until each is picked up.

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

---

## Page — Play hub ✅ implemented 2026-07-06 (pending review)

Audited against `CDb Design System/ui_kits/web/Play.jsx` + `kit.css`
(`.cdb-games-grid`/`.cdb-game-*` grepped separately from `.cdb-leader-*` and `.cdb-live-*`, per the
handoff — no single `cdb-play-*` prefix). **Highest drift since the homepage.** Unlike
Settings/Auth/Landing, this isn't a sizing/copy pass — two whole sections are missing and the
header + card anatomy both differ structurally.

Current files: `src/app/(main)/play/page.tsx` (8-line auth wrapper, unchanged),
`src/components/games/game-hub.tsx` (52 lines, all current content),
`src/lib/games/client-config.ts` (`getAllGameConfigs()`).

### Kit section order (target)

1. `PageHeader` shell header: left-aligned title "Games" + subtitle "Challenge yourself or compete
   with friends.", no action (utility register — plain sans, not editorial serif... **correction,
   see below**).
2. `cdb-games-grid`: 3-column grid (always 3 across ≥ some breakpoint, 1 column on mobile), one
   `cdb-game-card` per game — icon tile, title, description, meta row ("Solo · Multiplayer" +
   trailing arrow).
3. `cdb-two-col` row (1 col on mobile): **Game leaderboard** card (rank, avatar, name, wins ·
   played, win%, top 5, "This month" scope label) + **Live now** card (per-lobby row: icon, title +
   round/lobby state, participant names, cherry-tinted icon tile for in-progress, trailing arrow,
   click to jump in; pill badge "N active" with a pulsing cherry dot in the card header).

### Current order (live)

1. Centered header: `Gamepad2Icon` above an `<h1>`, subtitle below, all center-aligned. Contained in
   `max-w-4xl` (kit's `cdb-page-inner` is `max-w-[1200px]`, noticeably wider).
2. Grid of plain shadcn `Card`/`CardHeader`/`CardTitle`/`CardContent` tiles,
   `sm:grid-cols-2 lg:grid-cols-3` (already has the mobile `grid-cols-1` base — good, no
   overflow-trap risk here). Each card: icon + title in the header row, description in the body. No
   meta row, no "Solo · Multiplayer" line, no trailing arrow.
3. **Nothing.** No leaderboard section, no live-now section. The page ends after the game grid.

### Drift checklist

- [ ] **Header doesn't match the kit's `PageHeader` shell shape.** Kit:
      `flex items-end     justify-between`, title is `font-family: var(--font-display)` (the serif)
      at `44px`, subtitle below at `14px` muted, no icon, action slot on the right (unused here,
      `action={null}`). Live: centered `Gamepad2Icon` + `text-3xl font-bold` (sans, not display
      font) + centered subtitle. **Correction to the handoff's framing:** the handoff calls this
      header "utility register, not editorial" and warns not to over-editorialize it — but
      `PageHeader`'s own CSS (`.cdb-page-title`) _is_ `var(--font-display)` at 44px. This is the
      exact same treatment the homepage's `DashboardHeader` already implements in Tailwind
      (`src/app/(main)/home/_components/dashboard-header.tsx:60`:
      `font-display text-[44px]     leading-none font-normal tracking-[-0.015em]`, left-aligned,
      `flex items-end justify-between` wrapper). "Utility vs. editorial" here is about _tone/copy_
      (no italic accent word, no magazine framing), not about _typeface_ — the shell header is serif
      at 44px on every kit screen that uses it (only Dashboard and Play). Fix: rebuild the header
      left-aligned, serif 44px title, no icon (kit doesn't have one in `PageHeader`; the current
      `Gamepad2Icon` above the title isn't in the kit at all), subtitle unchanged copy. No action
      button (kit passes `action={null}`).
- [ ] **No shared `PageHeader` component exists in the app yet** (confirmed via grep — every page
      rolls its own header markup inline). Dashboard's `DashboardHeader` and Play's would be the
      only two consumers of this shape. Judgment call below on whether to extract one now or keep
      inline (matches the file-per-page convention every other finished page uses).
- [ ] **Container is `max-w-4xl`; kit's `cdb-page-inner` is `max-w-[1200px]`.** Bump to match — the
      3-col game grid and the 2-col leaderboard/live row both want the wider canvas the kit uses (a
      1200px-wide page reads very differently from 896px for a 3-up grid).
- [ ] **Game card anatomy differs from `cdb-game-card`.** Kit: dedicated icon tile (`48×48`,
      `var(--radius-md)`, `var(--bg-elev-3)` bg, `var(--border)` border — i.e.
      `cdb-game-icon-neutral`, confirming the handoff's cherry-reservation rule: these are neutral,
      not tinted), title at `18px/600`, description at `13px` muted, and a **meta row**
      (`margin-top: 14px`, `11px` uppercase `fg-dim`, `justify-content: space-between`) reading
      "Solo · Multiplayer" with a trailing arrow icon. Live: shadcn `Card`/`CardHeader`/`CardTitle`
      (bordered box, no dedicated icon tile styling, no meta row at all). Needs a rebuild of the
      card internals, not a restyle — different structure, not just spacing/color. - Sub-item:
      **"Solo · Multiplayer" is static copy in the kit, not per-game data** (kit's `games` array has
      no mode field; the line is hardcoded the same for all 3 cards). Confirmed `ClientGameConfig`
      (`src/lib/games/client-config.ts`) has no solo/multiplayer field either. Since all 3
      registered games already support both modes (each game's engine + API supports solo and
      multiplayer sessions per `GameMode = "solo" | "multiplayer"` in `src/lib/db/types.ts:25`),
      this can be static copy on the live cards too — no new field needed, this isn't a data gap.
- [ ] **No "Game leaderboard" card exists.** Needs: rank (1-indexed, gold/marquee-tinted for #1 per
      `style={i === 0 ? {color: 'var(--cdb-marquee)'} : {}}`), avatar, display name, "N wins · M
      played" meta line, win% (`round(wins/played * 100)`), top 5, "This month" scope label in the
      card header (`cdb-card-link`, muted, hover → marquee). - **This needs a new cross-user,
      cross-game-type aggregate — nothing existing produces it.** `src/lib/games/leaderboard.ts`'s
      `getLeaderboard()` is scoped to one `gameType` + `category` at a time and ranks by
      `best_score`, not win%. The per-user profile stats route
      (`src/app/api/users/[id]/games/stats/route.ts`) sums `games_played`/`games_won` across
      normal+hard categories for **one user**, which is the right win/played _shape_ to reuse
      conceptually, but it needs to become a `GROUP BY user_id` across **all users and all 3 game
      types** combined, ordered by win rate. New query, likely in `src/lib/games/leaderboard.ts` or
      a new `src/lib/games/group-leaderboard.ts`. TDD per CLAUDE.md convention (pure formatter/sort
      testable, DB part mocked). - **"This month" scope**: the kit's label implies a time-windowed
      leaderboard, but `game_leaderboard` has no period dimension (it's all-time best-per-category,
      updated in-place per `updateLeaderboard()` — no per-month rows). Judgment call below: either
      treat "This month" as an all-time leaderboard with kit-matching label copy (kit uses
      placeholder data throughout, per the pinned decision that we don't copy its fake
      numbers/labels blindly), or add real month-scoping (bigger lift: needs a
      `created_at`/`updated_at`-windowed query against `game_sessions`/`game_players` instead of the
      pre-aggregated `game_leaderboard` table, since that table has no time dimension to filter
      on). - **`countAll()` trap applies if this new query computes any rank via count-based math**:
      follow the fixed pattern at `games/stats/route.ts:68` (type the query `countAll<string>()`,
      then `Number(result.count)`), not the unwrapped `countAll<number>()` used elsewhere in
      `leaderboard.ts`/`games/[id]/*` (those are plain existence/count checks, not rank math, so
      they're fine as-is — don't "fix" them, they're not the bug pattern).
- [ ] **No "Live now" section exists.** Needs: card header with a pill badge ("N active" + pulsing
      cherry dot, `cdb-pill-live` / `cdb-pulse`), a list of in-progress multiplayer game rows (icon
      tile, cherry-tinted per the reserved-for-live rule, title + round/lobby state text,
      participant names, trailing arrow, click → jump into that game). - **No existing infra reads
      "what's live right now across the group."** Checked `src/hooks/use-*` for a multiplayer
      presence hook — only `use-online-users.ts` exists (global online/offline presence via Ably, no
      per-game-lobby concept). Checked `src/app/api/games/route.ts` — only exports `POST` (create),
      no `GET` (list). **This is simpler than it first looks, though**: `game_sessions`
      (`status: "lobby" | "active" |       "finished"`, `mode: "solo" | "multiplayer"`,
      `current_round`) plus `game_players` already have everything needed as a **direct DB query** —
      `WHERE mode = 'multiplayer' AND status IN       ('lobby', 'active')` joined to `game_players`
      for participant names — no new Ably presence channel required, this can be a polled/SWR'd API
      route like every other data section on this page, not a real-time presence subscription.
      Recommend against building new Ably presence infra for this unless real-time push (not just
      SWR refresh) is a hard requirement — judgment call below. - **Resolved 2026-07-06**: kit's
      active-row meta ("Sam, Jamie, Alex · 28% revealed") bakes in a reveal percentage that only
      exists client-side (`poster-reveal-visual.tsx`'s `revealProgress`, driven by
      `requestAnimationFrame` elapsed time since round start — never persisted server-side).
      Computing it in a hub-level query would need per-game-type duration constants baked into the
      aggregate and would only apply to poster-reveal (rating-guess/ year-guess have no
      reveal-percent concept). **Owner confirmed: drop the % detail.** Active rows show
      `"{Game name} · Round {currentRound + 1} of {roundCount}"` (server-truth from `game_sessions`,
      same `+1` display convention as the in-game UI) with a simple "in progress" or
      participant-names meta line — no fabricated/estimated percentage. Lobby rows keep
      `"{Game name} · Lobby"` +
      `"{count}/{roundCount is NOT the cap — use game_players.length}       joined"` wording (kit's
      own example: "Harm waiting · 1 / 4 joined" — the "4" there is lobby capacity context, not
      round count; confirm actual copy at implementation time against whatever cap, if any,
      multiplayer lobbies enforce).
- [ ] **Copy check**: "Challenge yourself or compete with friends." subtitle already matches the kit
      verbatim — no change needed there.

### Judgment calls — resolved with owner 2026-07-06

1. **Shared `PageHeader` component: keep inline.** Owner confirmed — new `play-hub-header.tsx` (or
   equivalent), matching Dashboard's own bespoke `DashboardHeader` pattern. No extraction, no
   Dashboard refactor. Matches the established per-page-file convention every other finished page
   used.
2. **"This month" leaderboard scope: all-time, relabel honestly.** Ship the win-rate leaderboard as
   all-time (matches what `game_leaderboard` actually stores), change the kit's "This month" scope
   label to something accurate ("All time", or drop the scope text entirely — decide at
   implementation time). No month-windowed query.
3. **"Live now" data source: direct DB query + SWR.** Query `game_sessions` (`mode = 'multiplayer'`,
   `status IN ('lobby', 'active')`) joined to `game_players`, polled like the rest of the page's
   data. No new Ably presence channel/infra.
4. ~~**Card click target for solo-vs-multiplayer**~~ — **resolved, no longer a judgment call.**
   Verified `src/components/games/poster-reveal/play-page-content.tsx:159-195`: each `basePath` page
   (`/play/poster-reveal` etc.) renders a `Tabs` with `Solo` / `Multiplayer` triggers ("Start Solo
   Game" / "Create Multiplayer Lobby"). The kit's single-click-through-to-picker flow already
   matches; "Solo · Multiplayer" meta copy is accurate as shipped, no copy adjustment needed.

### Acceptance criteria

- [ ] Header rebuilt to match `PageHeader`: left-aligned, `font-display text-[44px]`, subtitle
      below, no icon, no action button, container widened to `max-w-[1200px]` (or the app's
      equivalent token/class).
- [ ] Game cards rebuilt to `cdb-game-card` anatomy: dedicated neutral icon tile, title,
      description, meta row ("Solo · Multiplayer" + trailing arrow icon), still linking to each
      game's `basePath`.
- [ ] New cross-game, cross-user leaderboard query (TDD, pure part unit-tested per convention)
      ranked by win rate, returns top 5 with rank/avatar/name/wins/played/win%; rendered in a
      `cdb-leader-row`-equivalent list matching the kit's structure; gold/marquee tint on rank #1.
      All-time (not month-windowed); scope label changed from the kit's "This month" to something
      accurate ("All time" or no scope text).
- [ ] New "Live now" data source: direct `game_sessions`/`game_players` DB query
      (`mode =     'multiplayer'`, `status IN ('lobby', 'active')`) + SWR, no new Ably presence
      infra. Surfaces in-progress multiplayer sessions with participant names and round/lobby state;
      empty state handled gracefully (kit only mocks the populated state) — cherry tint reserved for
      this list only, no bleed onto the static game cards.
- [ ] Two-column layout (`cdb-two-col`) for leaderboard + live-now, collapsing to 1 column on
      mobile/narrow widths (base `grid-cols-1`, per the standing overflow-trap rule).
- [x] Verified game `basePath` routes already offer a solo/multiplayer choice (judgment call 4,
      resolved) — "Solo · Multiplayer" meta copy ships as-is.
- [x] `pnpm typecheck` / `pnpm lint` / `pnpm test` stay green (608 tests, +9 new: 6 for
      `rankGroupLeaderboardEntries`, 3 for `formatLiveSession`).
- [x] Manual review + `feature-dev` code-review subagent. One Important finding (a code comment
      cited the uncommitted `HANDOFF.md` as the follow-up location for the stale-session issue below
      — fixed to cite this spec doc instead, which is committed) and one minor style note (the
      ad-hoc SQL interval filter was simplified to the existing `new Date(Date.now() - ms)` pattern
      from `src/lib/notifications/cleanup.ts`). Both applied before commit.
- [x] Headless verification (1440px, 320/390/768px, light + dark) — 0px horizontal overflow at every
      width, header/cards/leaderboard/live-now all render, empty states correct, a real multiplayer
      lobby created via the API renders correctly in "Live now" (cherry tint, pulse dot, "1 joined",
      cleaned up after).
- [ ] Light mode readable, no broken tokens (owner visual pass) — same standing item as every other
      finished page. Headless check above is a proxy, not a substitute for the owner's real pass.

**New finding during implementation, not in the original audit:** `game_sessions` has no
cleanup/expiry mechanism — testing "Live now" against the dev DB surfaced 51 multiplayer
lobby/active sessions from ~4 months ago (March 2026) that had never been marked `finished`, which
would have rendered as "51 active" in production for any group whose members abandon a game without
finishing it. **Owner-confirmed fix (2026-07-06):** added a defensive recency filter to
`fetchLiveSessions()` (`created_at` within the last 3 hours) so this page ships correctly now, but
the root cause — no mechanism ever marks an abandoned session non-live — is unresolved and tracked
as a follow-up in `HANDOFF.md` ("Stale multiplayer session cleanup"), not silently dropped.

**Root cause fixed 2026-07-08** (separate session from the design-system rollout — see
`HANDOFF.md`'s "Current status" for the full writeup, not duplicated here since this was backend
hygiene, not a kit-fidelity page). Migration 0032 added a new `abandoned` status (kept distinct from
`finished` so leaderboard/stats queries keep meaning "real completed game" with no extra filtering);
`cleanupAbandonedGameSessions()` (`src/lib/games/cleanup.ts`) marks sessions abandoned on a tiered
inactivity threshold (45 min for an unstarted lobby, 2.5 hrs of no round/guess activity for an
active game) and runs lazily off Play hub traffic, same pattern as `cleanupOldNotifications`. The
defensive 3-hour recency filter above is now removed from `fetchLiveSessions()` — no longer needed
since stale sessions are actually marked rather than just filtered at read time. Backfilled and
verified clean on both dev (88 stale sessions) and prod (76).

---

## Page — Sidebar / Shell ✅ implemented 2026-07-07 (pending owner review)

Audited against `CDb Design System/ui_kits/web/Shell.jsx` + `kit.css` (`.cdb-sidebar*`,
`.cdb-sb-upnext*`, `.cdb-nav-*`, `.cdb-online-*`, `.cdb-user-chip*`, `.cdb-page-header*`). Unlike
every prior entry, this is the **shared shell rendered on every authenticated page**, not a
standalone route — drift here affects every page at once.

Current files: `src/components/app-sidebar.tsx` (208 lines),
`src/components/sidebar/up-next-card.tsx` (64 lines), `src/components/online-users.tsx` (77 lines,
rendered inside the sidebar's `SidebarContent`), `src/components/ui/sidebar.tsx` (shadcn primitive,
not modified).

**Lowest drift of any page so far in structure/order** — the section order already matches the kit
exactly (brand → up-next card → nav → online → user footer), and `UpNextCard` already exceeds the
kit (real queue/watchlist/in-progress data vs. the kit's hardcoded `MEDIA[2]`). The drift here is
concentrated in a few specific anatomy gaps, not a rebuild.

### Kit section order (target)

1. `cdb-sidebar-head`: 32×32 amber icon tile (`I.Clapper`) + wordmark (`CDb` with italic amber `b`)
   - "Movie nights, tracked" tagline, links to Home.
2. `cdb-sb-upnext`: mini poster + eyebrow (pulsing amber dot + "Up next · {date}") + title +
   "Proposed by {name}", links to Home.
3. `cdb-sidebar-group-label` "Navigation" + `cdb-sidebar-nav`: Home/Database/For
   You/Play/Users/Admin (admin gated), active item gets a background tint + left-edge amber rail
   (`.cdb-nav-item.active::before`) + amber icon/text; Admin row carries a small mono "admin" tag,
   amber-tinted when active.
4. `cdb-sidebar-group-label` "Online" + `cdb-sidebar-online`: one `cdb-online-row` per online user —
   status dot + avatar(20px) + name, vertical list.
5. `cdb-sidebar-footer` → `cdb-user-chip`: avatar(28px) + name + email-style subtext, plain link to
   Settings.

### Current order (live)

1. `SidebarHeader`: `Wordmark` + static tagline link to `/home`. **No icon tile at all.**
2. `SidebarContent` → `UpNextCard` (queue/watchlist/in-progress sourced, real data, richer than kit)
   → `SidebarGroup` "Navigation" (same 6 items, admin-gated, active state via shadcn `isActive`) →
   `OnlineUsersSection` (overlapping avatar stack + tooltips, not a list).
3. `SidebarFooter`: avatar + name + email inside a `DropdownMenu` (Profile / Settings / theme toggle
   / Log out), not a plain link.

### Drift checklist

- [x] **No brand icon tile.** Kit's `cdb-sidebar-mark` (32×32, `bg-cdb-marquee`, `cdb-ink-950`
      clapper icon, `radius-sm`) is entirely absent from `SidebarHeader` — just the wordmark +
      tagline today. Needs a small icon tile added next to the `Wordmark`, matching the kit's
      amber-square treatment. `ClapperboardIcon` (lucide) is the closest match to the kit's
      `I.Clapper`. **Added.**
- [x] **Active nav item has no amber tint at all, and no left-rail.** Confirmed via
      `src/components/ui/sidebar.tsx` + `globals.css` tokens: `SidebarMenuButton`'s active state is
      `data-[active=true]:bg-sidebar-accent` (→ `--bg-elev-2`) + `text-sidebar-accent-foreground` (→
      plain `--fg`, not amber). Kit's `.cdb-nav-item.active` is `background: var(--bg-elev-3)` (one
      step darker/richer than what we use), `color: var(--cdb-marquee)` (amber text),
      `svg { color:     var(--cdb-marquee) }` (amber icon), plus a `::before` 2px amber left-rail
      (`left: -10px`). This is a bigger gap than "missing decorative rail" — the active item
      currently isn't amber-tinted at all, just a neutral background/text shift. Fix: scoped
      `className` override on `SidebarMenuButton` consumer (per the "don't touch shared primitives"
      pinned decision) —
      `data-[active=true]:text-cdb-marquee-text data-[active=true]:bg-[var(--bg-elev-3)]     [&[data-active=true]>svg]:text-cdb-marquee-text`
      plus a `before:` pseudo-element for the rail
      (`before:absolute before:left-0 before:inset-y-2 before:w-0.5 before:rounded-full     before:bg-cdb-marquee`,
      shown only `data-[active=true]:before:block` or via a conditional class). Confirm via grep
      this override is scoped to `app-sidebar.tsx`'s nav items only, not a `SidebarMenuButton`-wide
      change. **Added — with one correction found during review, see "Review outcome" below: the
      rail lives on `SidebarMenuItem` (via a separate `NAV_ITEM_RAIL_CLASS` using
      `has-data-[active=true]:before:*`), not on `SidebarMenuButton` itself, because the button's
      own `overflow-hidden` would otherwise clip a rail bleeding outside its box.**
- [x] **No "admin" mono tag on the Admin nav item.** Kit shows `cdb-nav-admin-tag` (9px mono
      uppercase, `fg-dim`, amber-tinted when active) next to the label. Live just gates the whole
      item by role with no tag at all. Minor addition once the item renders — small `<span>` after
      the label. **Added.**
- [x] **`UpNextCard` has no card chrome at all — reads as blending into the background, not a
      distinct card.** Kit's `.cdb-sb-upnext` gives it: (1) an always-on
      `linear-gradient(180deg,     var(--bg-elev-2), var(--bg-elev-3))` background +
      `1px solid var(--border)` + `radius-md`, so it reads as a card at rest, not just on hover; (2)
      a `::after` left-rail — 2px solid amber bar, full height, `opacity: 0.85` — the same left-rail
      language as the active nav item, marking this as the "featured" element in the sidebar. Live
      `up-next-card.tsx` has **none of this** — it's a flush `Link` with only a
      `hover:bg-sidebar-accent` transition and no resting-state background, border, or rail at all.
      This is likely the single biggest visual-fidelity gap in the sidebar pass (bigger than the
      missing brand icon tile) since the kit clearly intends this to be a standout card, not a
      nav-adjacent row. **Added** — this card's own wrapper isn't clipped, so its `before:` rail
      didn't hit the same overflow-clipping bug as the nav rail.
- [x] **`UpNextCard` title uses the wrong font family.** Kit's `.cdb-sb-upnext-title` is
      `font-family: var(--font-display)` (the editorial serif) at 15px. Live uses
      `text-sm     font-medium` — that's the sans (Geist) default, no `font-display` class applied.
      Needs `font-display` added to the title `span`. **Added** (also changed the eyebrow text color
      from muted gray to `text-cdb-marquee-text`, matching the kit's `.cdb-sb-upnext-eyebrow` amber
      color — a drift item not caught in the original audit, found while implementing).
- [x] **Online users: vertical list vs. avatar stack — resolved below (judgment call 1).** Built.
- [x] **Footer: dropdown vs. plain link — resolved below (judgment call 2, keep dropdown).** No
      change needed — footer was left as-is per the resolution.
- [x] **Sidebar width: 240px (kit) vs 256px (shadcn `--sidebar-width` default) — resolved below
      (judgment call 3, leave default).** No change made, per resolution.
- [x] **Copy**: tagline — live currently says "A cinema database for friends."; kit says "Movie
      nights, tracked." **Owner confirmed 2026-07-07: adopt the kit's copy verbatim.**
- [ ] **`PageHeader` shell** (`cdb-page-header`/`cdb-page-title`/`cdb-page-sub`) is also defined in
      `Shell.jsx` alongside `Sidebar` — but every page already rolls its own bespoke header
      component (confirmed via the Play hub audit: "no shared `PageHeader` component exists... every
      page rolls its own header markup inline," judgment call resolved to keep it that way). **Out
      of scope for this pass** — no new page-header work here, this section is sidebar-only. Noting
      only so the "Shell.jsx also defines PageHeader" fact doesn't get missed/rediscovered later.

### Judgment calls — proposed, awaiting confirmation

1. **Online users: hybrid, list-first.** Owner's guidance: match the kit's vertical list by default,
   but avoid crowding the nav when many users are online — exact row cap "might need adjusting
   depending how many rows fit comfortably." Proposal: render kit-style `cdb-online-row` rows (dot +
   avatar + name) up to a cap (start at **8**, tune after a real headless look at how much vertical
   space the sidebar has alongside nav + up-next card at typical viewport heights), then collapse
   the remainder into a trailing "+N more" row in the same list style (not a switch to the
   avatar-stack pattern — keeps one visual language). The group is small in practice (6 known
   members: tester, harm, tose, schleado, grewy, ant per `HANDOFF.md`), so the overflow row will
   rarely if ever trigger today; this is about not regressing if the group grows. Existing
   `MAX_VISIBLE` overflow-counting logic in `online-users.tsx` is reusable, just needs a different
   per-row render (list row, not stacked avatar).
2. **Footer: keep the `DropdownMenu`.** Owner confirmed — the kit's plain Settings-link chip doesn't
   have anywhere to put the theme toggle or logout, and the dropdown is the natural home for both.
   Ship as: same chip _visual_ styling (avatar + name + subtext matching `cdb-user-chip`
   proportions) with the dropdown interaction preserved, not simplified to a link.
3. **Sidebar width: leave the shadcn 256px default.** Owner confirmed — 16px off the kit's 240px is
   marginal and `--sidebar-width` is a shared primitive value already used for collapse/rail math
   app-wide; not worth a scoped override for this.

### Acceptance criteria

- [x] Brand icon tile added to `SidebarHeader` (32×32 amber square, clapper icon) next to the
      `Wordmark`.
- [x] Admin nav item gets the small mono "admin" tag (amber-tinted when active), gating unchanged.
- [x] Active nav item gets kit-matching amber tint (text + icon `text-cdb-marquee-text`, `bg-elev-3`
      background) and a 2px amber left-rail, via a scoped override on the `SidebarMenuButton`
      consumer in `app-sidebar.tsx` (not the shared primitive). Rail ended up living on
      `SidebarMenuItem` instead, bled `-8px` not the kit's `-10px` (still inside `SidebarContent`'s
      clip boundary) — see "Review outcome" below for the two-round fix.
- [x] `UpNextCard` gets kit-matching card chrome: always-on `bg-elev-2`→`bg-elev-3` gradient
      background, `border`, `radius-md`, and a 2px amber left-rail (`::after`-equivalent), not just
      a hover-state background.
- [x] `UpNextCard` title uses `font-display` (editorial serif), matching `.cdb-sb-upnext-title`.
- [x] Online users rebuilt as a kit-style vertical list (dot + avatar + name) with an overflow cap
      (starting at 8, tuned by headless measurement), replacing the avatar-stack pattern.
- [x] Footer chip visually matches `cdb-user-chip` proportions while keeping the `DropdownMenu`
      interaction (Profile / Settings / theme toggle / Log out unchanged). **Corrected during owner
      review** — the original build left the footer with no resting-state card background/border
      (same bug class `UpNextCard` had), and its avatar at 32px vs. the kit's 28px; both fixed, see
      "Review outcome" below.
- [x] Tagline copy: adopt kit's "Movie nights, tracked." verbatim.
- [x] Sidebar width left at the shadcn 256px default — no override.
- [x] `pnpm typecheck` / `pnpm lint` / `pnpm test` stay green (608 tests, unchanged — pure UI pass,
      no new pure logic needed a test).
- [x] Manual review + `feature-dev` code-review subagent, given the every-page blast radius. One
      Critical finding, fixed — see "Review outcome" below.
- [x] Headless verification at 1440/768/390/320px, light + dark, **on Home, Database, and a
      game-play surface** (`/play/poster-reveal`) — 0px overflow at every width/page except a
      **pre-existing, unrelated** 36px overflow on Home at 320px (confirmed present on `main` before
      this change too — part of the already-tracked "Homepage mobile overflow" deferred item, not a
      regression from this pass). Confirmed the collapsible icon-rail behavior
      (`collapsible="icon"`, app-only, not in the kit) still works, and specifically re-verified the
      new active-nav-item left rail renders (not clipped) in both expanded and icon-collapsed modes
      after the review fix.
- [ ] Light mode readable, no broken tokens (owner visual pass) — same standing item as every other
      finished page.

### Review outcome

`feature-dev` code-review subagent caught one **Critical** finding; the owner's own visual pass then
caught a **second**, related bug the subagent fix didn't fully resolve, plus two smaller sizing
misses. All fixed before this section was marked done:

- **Active-nav-item left rail, round 1 (subagent-caught): invisible on `SidebarMenuButton` itself.**
  The initial implementation put the amber `before:` rail directly on `SidebarMenuButton` (bleeding
  to `-left-2.5`, mirroring the kit's un-clipped `.cdb-nav-item::before`). But `SidebarMenuButton`'s
  own base class includes `overflow-hidden`, clipping the pseudo-element at the button's own box
  edge. **Fix:** moved the rail to `SidebarMenuItem` (a plain `<li>`, no clipping) via a new
  `NAV_ITEM_RAIL_CLASS` using `has-data-[active=true]:before:*`, keeping `NAV_ACTIVE_CLASS` (amber
  text/icon/background tint) on the button.
- **Active-nav-item left rail, round 2 (owner-caught): still invisible after the round-1 fix,
  because a higher ancestor also clips.** The round-1 verification checked
  `getComputedStyle(li, "::before")` and saw correct
  `display`/`background-color`/`position`/`left`/`width` values, and concluded the rail "paints" —
  but computed style on a pseudo-element reports its own box properties regardless of whether an
  ancestor visually clips it. That check didn't catch that `SidebarContent` (a few levels up the
  tree, needed for scrolling a long nav list) has `overflow-auto` unconditionally — which still
  clips content bleeding past its box exactly like `overflow-hidden` does. The `-left-2.5` (-10px)
  bleed past `SidebarMenuItem` was invisible in the actual rendered page despite the pseudo-element
  "existing" with the right computed styles. **Only a real screenshot surfaced this** — the owner
  reported "not seeing the rail" during their own pass, which prompted re-checking with a
  `page.locator(...).screenshot()` instead of trusting `getComputedStyle` alone. **Lesson for future
  `before:`/`::after` rail or bleed-outside-the-box fixes**: `getComputedStyle` on a pseudo-element
  only proves the rule matched and the pseudo-element itself has the right box properties — it says
  nothing about whether an ancestor's `overflow` (auto **or** hidden) clips it before it reaches the
  viewport. Always confirm with a real screenshot of the rendered region, not just computed style,
  when the fix depends on escaping an ancestor's box. **Fix:** walked the full ancestor chain's
  `overflow`/`overflowX` via `getComputedStyle` per-ancestor (not just the pseudo-element) and found
  `SidebarGroup`'s own `p-2` padding sits _inside_ `SidebarContent`'s clip boundary — so bleeding
  only `-left-2` (-8px, into that already-visible padding gutter) instead of the kit's literal
  `-10px` keeps the rail inside the actual clip boundary. Re-verified with
  `page.locator('li:has([data-active=true])').screenshot()` — rail now visibly renders as a thin
  amber line on the active item's left edge.
- **Footer chip had no card chrome at rest — same bug class as `UpNextCard`'s original gap, missed
  in the original audit and initial build.** The audit/build both focused on the footer's
  _interaction_ (dropdown vs. plain link, resolved to keep the dropdown) and didn't separately check
  its resting _visual_ chrome. Kit's `.cdb-user-chip` has an always-on
  `background: var(--bg-elev-2)` + `1px solid var(--border)` + `radius-sm`; the live
  `SidebarMenuButton` only had `data-[state=open]:bg-sidebar-accent` (dropdown-open state only) — no
  resting background/border at all, so it blended into the sidebar background exactly like
  `UpNextCard` did before this pass. Owner caught this in their visual pass. **Fix:** added
  `border-border bg-[var(--bg-elev-2)] border` to the footer `SidebarMenuButton`'s className,
  alongside the existing dropdown-open state classes.
- **Footer avatar was 32px (`size-8`), kit specifies 28px.** Minor miss, not part of the original
  audit checklist (avatar sizing wasn't itemized there). Owner asked to confirm/adjust; kit's
  `Shell.jsx` passes `size={28}` for the footer's `Avatar` (vs. `size={20}` for online-row avatars,
  confirmed separately, see below) — fixed to `size-7` (28px).
- **Online-users row text/avatar size: checked against the kit, already correct, no change made.**
  Owner asked whether the online list's avatar and name text read smaller than the kit. Re-checked
  `kit.css`'s `.cdb-online-row` (`font-size: 12px`, applies to the whole row including the name
  `<span>`) and `Shell.jsx`'s `<Avatar user={u} size={20} />` — both already matched exactly
  (`text-xs` = 12px, `size-5` = 20px). No change made; flagging here only so a future pass doesn't
  re-litigate this from a visual impression alone without re-checking the kit's actual numbers
  first.
- **"Navigation" group label didn't match "Online"'s label styling — both should share one
  treatment.** Kit uses a single class (`.cdb-sidebar-group-label`: `10px`, `font-weight: 600`,
  `letter-spacing: 0.12em`, `color: var(--fg-dim)`, uppercase) for _both_ group labels. The "Online"
  label (a plain `<p>` in `online-users.tsx`) was already built to this spec, but "Navigation" (a
  shadcn `SidebarGroupLabel`) was left with the primitive's own default styling
  (`text-xs font-medium`, no letter-spacing, no uppercase, lighter `text-sidebar-foreground/70`
  color) — a drift missed in the original audit and initial build since the two labels use different
  underlying components and weren't compared side-by-side until the owner's visual pass. **Fix:**
  added a scoped `className` override to the "Navigation" `SidebarGroupLabel` matching the exact
  class string already used on "Online"'s `<p>`. Verified via `getComputedStyle` that both labels
  now compute identically (`font-size: 10px`, `font-weight: 600`, `letter-spacing: 1.2px`, same
  color, `text-transform: uppercase`).
- **`UpNextCard`'s "Proposed by {name}" text was 11px, kit's `.cdb-sb-upnext-meta` is 10px.** Small
  miss from the initial build (this line wasn't itemized separately in the original drift checklist,
  which focused on the eyebrow/title). Fixed to `text-[10px]`.
- **`UpNextCard`'s pulse dot was pinned to the poster's top-right corner (pre-existing, predates
  this pass); kit puts it inline inside the eyebrow row, before the "Up next · {date}" text.**
  Confirmed via `Shell.jsx`: `<span className="cdb-pulse cdb-pulse-amber" /> Up next · Wed Jun 17`
  sits inside `.cdb-sb-upnext-eyebrow`, not attached to the poster at all — this was a structural
  difference the original audit didn't catch since it focused on the card's chrome/typography, not
  the pulse dot's position specifically. **Fix:** moved the dot from an absolutely-positioned badge
  on the poster (`absolute -top-1 -right-1 size-2`) to an inline `size-1.5` (6px, matching
  `.cdb-pulse`'s literal `width: 6px; height: 6px` exactly) span inside the eyebrow's `inline-flex`
  row, before the eyebrow text. Also fixed while touching this: the body's three lines
  (eyebrow/title/meta) were vertically centered (`justify-center`) against the poster's height
  instead of top-aligned like the kit (`.cdb-sb-upnext-body` is a plain top-to-bottom flex column,
  no centering) — changed to `justify-start`, and added the kit's exact `gap: 2px` between lines
  (`gap-0.5`).
- **Title's line-height wasn't set, so the kit's tighter 3-line spacing didn't come through even
  after the `gap-0.5` fix above.** Kit's `.cdb-sb-upnext-title` sets `line-height: 1.05` explicitly;
  the live title span had no `leading-*` class, inheriting a taller default for a 15px serif font,
  which visually read as more inter-line spacing than the kit despite the flex `gap` being correct.
  Fixed by adding `leading-[1.05]` to the title span.
- **Poster was 48px wide (`w-12`), kit specifies `width: 40px` on `.cdb-sb-upnext-poster`.** Also
  fixed the card's own `gap` from `gap-3` (12px) to `gap-2.5` (10px), matching `.cdb-sb-upnext`'s
  literal `gap: 10px`. Both measured directly via `getBoundingClientRect()`/`getComputedStyle` post-
  fix (40×60px poster, matching `aspect-ratio: 2/3` at 40px width; `10px` gap, `8px` padding) rather
  than eyeballed.

All of the above (pulse-dot position, top-alignment, line-height, poster/gap sizing) were caught
across several rounds of the owner's own visual pass, each a small, specific, correctly-scoped
callout — not machine-verifiable from a screenshot diff alone, since they're all
sub-pixel/structural details invisible without a side-by-side comparison against the live kit
screen. Re-verifying this outcome section's lesson from the earlier rail bug: several of these
(line-height, poster width) are exactly the kind of thing `getComputedStyle`/measurement checks
catch reliably once you know to look for them, but the audit process didn't originally surface them
because the original per-page audit compares kit _markup_/_CSS_ against live _code_, not a running
side-by-side render — worth remembering for future pages that a text-only audit can still miss
things a live visual comparison catches.

---

## Page — Game play surfaces (solo + multiplayer) ✅ implemented (pending owner review)

Audited and implemented 2026-07-06. Kit: `CDb Design System/ui_kits/web/GamePlay.jsx` (solo:
`GameConfig` → `SoloGame` → `RoundResult` → `GameOver`) and `GamePlayMP.jsx` (multiplayer: `Lobby` →
`LiveGame` → `MPResult`). Current: per-game
`src/components/games/{poster-reveal,rating-guess,year-guess}/*` (`play-page-content.tsx`,
`solo-game.tsx`, `multiplayer-game.tsx`, plus per-game visual/input/answer components) and shared
chrome (`round-result.tsx`, `game-result.tsx`, `game-lobby.tsx`, `live-scoreboard.tsx`,
`multiplayer-banners.tsx`, `multiplayer-result.tsx`, `multiplayer-page-content.tsx`,
`round-breakdown-row.tsx`, `player-guess-indicator.tsx`, `invite-players-dialog.tsx`).

### Headline finding

**Structure already matches the kit closely — this is a token/re-skin gap, not a layout gap.** All 3
games follow the kit's phase machine 1:1 (config screen → guessing → round result → game over; lobby
→ live round + scoreboard → round scores → auto-advance → final standings). But **zero `cdb-gp-*`
(or any `cdb-*`) classes are used anywhere in the ~20 game-play component files** — every component
is plain shadcn primitives (`Card`, `Badge`, `Select`, `Tabs`, `Slider`, `Input`, `Button`) styled
with default Tailwind color utilities (`text-blue-400`, `bg-emerald-500/15`,
`bg-red-500`/`bg-yellow-500`/`bg-primary` for timers) rather than the warm-dark/marquee-amber
tokens. The kit has a **dedicated 158-rule `cdb-gp-*` stylesheet** for this surface alone (poster
frame/blur/timer, slider thumb, round-result icon circles, score-pop typography, lobby/live-game/
standings) — none of it is referenced today. Scope-wise this is closer to the Play hub rebuild
(previously "highest drift since the homepage") than to a low-drift page like Settings/Auth.
**Owner-confirmed 2026-07-06: build as one unit across all 3 games** (not split into sub-passes),
same as the audit — expect multiple commits split by layer given the scale, same as Play hub.

### Kit section order (target)

**Solo:** Config screen (icon + title + blurb header; two-column: New Game card ‖ Leaderboard
preview card) → Guessing stage (scoreline → round info → per-kind visual+input → skip) → Round
result (header icon/text → answer block → score pop + streak → next button) → Game over (stats grid
→ round breakdown list → play again / back to games).

**Multiplayer:** Lobby (live pill + title + sub → settings badges → player list card → start +
copy-link/invite actions) → Live game (two-column: main stage ‖ sticky scoreboard; guessing stage or
round-scores-with-auto-advance-countdown) → Final standings (winner banner → stat grid → standings
list → play again / back to games).

### Current order (live)

Matches the kit's phase order exactly in all 3 games (confirmed via `play-page-content.tsx`,
`solo-game.tsx`, `year-guess/solo-game.tsx`, `multiplayer-page-content.tsx` for the phase-machine
shape). The gap is visual treatment, not structure or ordering.

### Drift checklist

- [ ] **No `cdb-gp-*` tokens anywhere.** Full re-skin across config screens (×3), solo visuals/
      inputs (×3 games: `poster-reveal-visual.tsx`/`guess-input.tsx`,
      `rating-guess-visual.tsx`/`rating-input.tsx`, `year-guess-visual.tsx`/`year-input.tsx`),
      shared `round-result.tsx`/`game-result.tsx`, `game-lobby.tsx`, `live-scoreboard.tsx`,
      `multiplayer-result.tsx`, `round-breakdown-row.tsx`. Key token targets from `kit.css`: -
      Config: `cdb-gp-config-title` (44px `font-display`), `cdb-gp-mode-tabs`/`cdb-gp-mode-tab`
      (segmented pill, active = `bg-elev-3` + `color: var(--cdb-marquee)`),
      `cdb-gp-lb-rank.r1/r2/       r3` (gold/silver/bronze color-mix chips). - Guessing:
      `cdb-gp-scoreline-num` (40px `font-display`), `cdb-gp-timer-fill` (marquee/warning/ cherry
      ramp by progress), `cdb-gp-slider-value` (44px `font-display`), `cdb-gp-range` thumb
      (marquee-amber circle w/ `--bg-elev-1` border). - Round result: `cdb-gp-rr-icon` (56px circle,
      tone-tinted bg), `cdb-gp-vs-num` (46px `font-display` yours-vs-actual), `cdb-gp-score-plus`
      (38px `font-display`, marquee-amber "+points"), `cdb-gp-diff-badge` (tone-tinted pill). - Game
      over: `cdb-gp-over-title` (48px `font-display`), `cdb-gp-stat-grid` (4-up),
      `cdb-gp-       breakdown-mark.ok/no` (success/cherry tinted circles). - Lobby:
      `cdb-gp-lobby-title` (34px `font-display`), `cdb-gp-host` (star-tinted pill),
      `cdb-gp-online-dot`. - Live: `cdb-gp-live` (main ‖ 260px sticky scoreboard grid),
      `cdb-gp-sb-row.you` (marquee 10%-tint highlight), `cdb-gp-rs-row`/`cdb-gp-rs-mark.ok/no`,
      `cdb-gp-standing-medal.m1/m2/m3`.
- [ ] **Missing cherry-red "live" pulse pill.** Confirmed absent — grepped `live-scoreboard.tsx`,
      `game-lobby.tsx`, `multiplayer-result.tsx`, `round-breakdown-row.tsx`,
      `player-guess-indicator.tsx` for `pulse`/`rose`/`cherry`/"Live", zero matches. The kit uses
      `cdb-pill-live` + `cdb-pulse` (cherry dot, `animation: cdb-pulse 1.8s infinite`) as the
      signature live-multiplayer signal in both the Lobby header and the in-round header ("Live ·
      Round N/total"). Add to `game-lobby.tsx` (lobby header) and the live-round header (currently
      just plain text/no pill at all in any of the 3 games' `multiplayer-game.tsx`) — this is
      exactly the surface the project's own cross-cutting rule reserves cherry for, so no judgment
      call needed, just an add.
- [ ] **Title Case → sentence case**, shared across all 3 games since the code is shared: "Game
      Over" → "Game over" / "Round Breakdown" → "Round breakdown" / "Play Again" → "Play again" /
      "Next Round" → "Next round" (`game-result.tsx`, `round-result.tsx`); "Start Game" → "Start
      game" / "Copy Link" → "Copy link" / "Invite Friends" → "Invite friends" / "{name} Lobby" →
      "{name} lobby" (`game-lobby.tsx`).
- [ ] **Em-dash violation**: `multiplayer-banners.tsx:33` — `"Submitted: {rating} — +{score} pts"`.
      Replace with `·` per the established separator convention (no em-dashes in user-facing copy).
- [ ] **Emoji result-headers** (🎯👏🤏😬💨) in `rating-answer-display.tsx` (`getRatingResultHeader`,
      ~L137-152) and `year-answer-display.tsx` (`getYearResultHeader`, ~L136-151). The kit's own
      `ratingHeader`/`yearHeader` mock functions use the same emoji — but the project's
      cross-cutting rule bans emoji outright, and `RoundResult`'s title-guess case already sets the
      precedent of icon-only tone headers (`I.Check`/`I.X`). **Owner-confirmed 2026-07-06: map each
      accuracy tier to a Lucide icon**, matching that existing precedent — replace the emoji field
      with an icon component per tier (e.g. bullseye/close/not-bad/far-off/way-off →
      `Target`/`ThumbsUp`/`Meh`-equivalent/`AlertTriangle`/`Wind`-or-similar; finalize exact icon
      choices at implementation time) instead of a literal 1:1 port of the kit's emoji set.

### Keep as-is (confirmed, not drift)

- **Rating Guess's Time Limit selector** (5/7/10/12/15s, in the config screen alongside difficulty/
  rounds) — a real feature beyond what the kit models (the kit assumes one universal timer per game
  type with no config). Keep.
- **Real Ably presence in the multiplayer lobby** (`game-lobby.tsx`'s online dot, host-disconnect
  detection via `usePresenceListener`, join/leave toasts) — the kit fakes a static 4-player roster
  client-side; this is exactly the "kit uses placeholder data, we wire real data" pattern from the
  pinned decisions. Keep, don't regress to match the kit's mock.
- **Multiplayer scoring is real, not simulated**: the kit's `LiveGame.submit()` fakes other players'
  guesses with `Math.random()` and a fixed 5s auto-advance countdown; the app's real multiplayer
  flow uses actual Ably-synced guesses per player and real round/game state from
  `game_sessions`/`game_rounds`/`game_guesses`. Match the kit's **visual treatment and interaction
  rhythm** (round-scores list, auto-advance countdown UI) — never its fake-data mechanism. No
  changes needed to the underlying real-time logic itself, this is a styling-only pass over already
  real functionality.

### Judgment calls — resolved with owner 2026-07-06

1. **Audit/build scope: one unit across all 3 games, not split into sub-passes.** Despite the larger
   token gap than expected, keep the single-pass-per-page convention; just expect more commits split
   by layer (shared chrome first, then per-game visuals) than a typical "low drift" page.
2. **Emoji result-headers: map to Lucide icons**, not kept as an intentional exception. See drift
   checklist item above.

### Acceptance criteria

- [x] All `cdb-gp-*`-equivalent styling applied across config, guessing, round-result, game-over,
      lobby, and live-game surfaces for all 3 games (via Tailwind utilities/tokens, not by importing
      the kit's literal CSS file) — pixel-faithful per the pinned fidelity decision.
- [x] Cherry-red "live" pulse pill added to the lobby header and in-round live header (both
      previously missing entirely) — reuses the `animate-up-next-pulse` recipe from the Play hub's
      `HubLiveNow`.
- [x] Title Case → sentence case fixed in `game-result.tsx`, `round-result.tsx`, `game-lobby.tsx`,
      `multiplayer-result.tsx`, config screens ("New game", "Time limit"),
      `invite-players-dialog.tsx`.
- [x] Em-dash in `multiplayer-banners.tsx:33` replaced with `·`.
- [x] Emoji result-headers in `rating-answer-display.tsx`/`year-answer-display.tsx` replaced with
      Lucide icon-per-tier (`TargetIcon`/`CheckCircle2Icon`/`ThumbsUpIcon`/`AlertTriangleIcon`/
      `WindIcon`), matching `RoundResult`'s existing icon-only precedent. Verified live in both solo
      and real multiplayer rounds.
- [x] Rating Guess's Time Limit selector and real Ably lobby presence preserved (not reverted toward
      the kit's mock) — confirmed present and functioning in the live multiplayer verification
      below.
- [x] `pnpm typecheck` / `pnpm lint` / `pnpm test` stay green throughout — 608 tests unchanged (pure
      styling/copy pass over existing real functionality, no new pure logic needed).
- [x] Headless verification at 1440/768/390/320px, light + dark, 0px horizontal overflow (after the
      320px grid/Select fix below), both a solo game and a real 2-player multiplayer
      lobby/live-round exercised end-to-end via Playwright (not just the empty/idle states) —
      confirmed synced scores, round-scores list, and auto-advance countdown all render correctly
      with real Ably data.
- [x] Manual review + `feature-dev` code-review subagent pass, reconciled before commit — see below.
- [ ] Light mode readable, no broken tokens (owner visual pass) — same standing item as every other
      page. Not a code gap, just not yet done by the owner.

**New finding during implementation, not in the original audit:** the config screen's "New game" /
"Leaderboard" two-column grid didn't collapse to `grid-cols-1` below `lg`, and neither the shadcn
`Card` usage nor the difficulty/rounds/time-limit `SelectTrigger`s had `min-w-0`/`w-full`, so both
cards stayed pinned near their content width in a much narrower grid cell — 3-34px of horizontal
overflow at 320px across all 3 games. Pre-existing structure (confirmed via `git log -p`, not
introduced by the token/copy commits above). **Owner-confirmed fix (2026-07-06):** added a base
`grid-cols-1` (the project's standard responsive-grid convention) + `min-w-0` on the grid/Card +
`w-full` on the `SelectTrigger`s, landed as its own commit (`6a26886`) separate from the styling
pass. 0px overflow at 320/390/768/1440px afterward.

### Review outcome (2026-07-06)

Manual review + a `feature-dev` code-review subagent pass, run in parallel and reconciled. One
Important finding, confirmed and fixed:

- **`SubmittedYearBanner` in `year-guess/multiplayer-game.tsx` was missed by the token/copy pass.**
  It's a year-formatting analog to the shared `SubmittedBanner` in `multiplayer-banners.tsx` (needed
  because it formats a whole year, not a decimal rating), so it lives as a separate local component
  and wasn't touched when the shared banner was tokenized. Still had a raw `border-blue-500/30`/
  `text-blue-400` color and an em-dash separator (`"Submitted: {year} — +{score} pts"`). Fixed to
  match its sibling: `text-cdb-info` + `color-mix(...)` background, middot separator. Verified live
  in a real 2-player multiplayer round (`725f6da`).

Everything else checked clean: no accidental logic changes across any of the 20 touched files
(confirmed independently by both the manual pass and the subagent); the `bg-current/16` icon-tint
pattern is sound (verified live via screenshot — background and icon correctly inherit the same tone
from one `text-cdb-*` class via CSS `currentColor`); the new `roundLabel` prop on the shared
`ScoreHeader` is correctly threaded through all 3 games' multiplayer call sites and confirmed absent
from all 3 solo games (which each keep their own separate local `ScoreHeader`, unaffected); the
`LucideIcon` type change on `getRatingResultHeader`/`getYearResultHeader` has no stale string-emoji
call sites remaining; and the 320px overflow fix was applied identically across all 3 games' config
screens.

**Noted then fixed same day (2026-07-07):** a handful of `SelectItem` option labels
(`"Normal — From your database"`, `"Custom settings — scores won't appear..."`, etc.) in all 3
games' config screens used an em-dash and predated this pass entirely (verified via `git log -p`,
not touched by the token/copy commits above). Initially flagged as out-of-scope rather than
scope-creeping into copy this page's audit didn't originally call out, then fixed as a quick
same-session follow-up since it was the same 3 files already touched (`bdb199d`) — `·` middot
throughout, same pattern as everywhere else in this pass. A broader app-wide em-dash sweep beyond
this page is still worth doing at some point (other already-shipped pages may have the same issue),
but no longer applies to Game play surfaces.

---

## Page — Admin ✅ implemented 2026-07-07 (pending owner review)

Audited against `Admin.jsx` + `kit.css` (`cdb-admin-*`, plus the reused `cdb-us-header` /
`cdb-us-issue-line` masthead pattern and `cdb-up-tabs` segmented tabs). Live files:
`src/app/(main)/admin/page.tsx`,
`src/components/admin/{audit-log-table,user-management,invite-codes}.tsx`.

**Overall: medium drift, chrome-heavy.** The three panes' structure (filter/action bars, table
columns, row anatomy, dialogs, actions) already matches the kit almost 1:1, and functionality
exceeds it (confirm dialogs, temp-password flow, toasts, tooltips, motion rows). The gap is chrome
and copy: a plain sans `h1` instead of the kit's editorial masthead + issue line, default shadcn
tabs instead of the gold-active segmented tabs, default shadcn table styling instead of the kit's
uppercase-header/elev-1 table chrome, raw Tailwind palette badge colors instead of the semantic
tokens, and "Users" naming that violates the "never users" copy rule. No new DB queries needed.

### Kit section order (target)

1. Editorial masthead (explicitly reuses the Users/Database pattern per the kit's own comment):
   eyebrow `Back office · admin only` → serif title "The _back office_" → italic lede "Who's in, who
   got invited, and a paper trail of everything that's happened in the group."
2. Issue line: `Access · admin` · rule · `5 members · 2 active codes` (kit mock numbers — we wire
   real counts)
3. Segmented tab bar (`cdb-up-tabs` reuse): **Audit log / Members / Invite codes** (13px icons)
4. Active pane, each = bar (desc/filters left, mono count or actions right) + table inside
   `cdb-admin-table-wrap` chrome; audit pane adds pagination below

### Current order (live)

1. Plain sans `h1` "Admin" + muted sub — no eyebrow, serif, lede, or issue line
2. (no issue line)
3. shadcn `TabsList` default chip: "Audit Log" / "Users" / "Invite Codes"
4. Panes — structure matches (audit: filter bar + table + pagination; invites: bar + table;
   **Members has no bar at all**, kit has desc + count)

### Drift checklist

Header:

- [x] **Masthead**: replace `h1`+`p` with the kit's editorial masthead — same markup as
      `users/page.tsx`'s header (eyebrow → serif clamp title with amber italic accent → italic
      lede). Play-hub caveat applies: the kit gives even this utility-register page an editorial
      masthead; don't "fix" it to plain sans.
- [x] **Issue line**: `IssueLine` with left `Access · admin`, right `N members · M active codes` —
      real counts by lifting `useAdminUsers` + `useInviteCodes` to page level (SWR dedupes with the
      panes' own hooks; admin-only page, tiny payloads; no new DB query).

Tabs:

- [x] Gold-active soft-chip tabs — reuse the `PROFILE_TAB_CLASS` pattern from `users/[id]/page.tsx`
      (kit's `cdb-up-tab.active`).
- [x] Copy: "Audit Log" → **"Audit log"**, "Users" → **"Members"**, "Invite Codes" → **"Invite
      codes"** (kit labels; "never users" copy rule).

Table chrome (all three panes, via className on the consumers — no touching
`src/components/ui/table.tsx`):

- [x] Kit `cdb-admin-table-wrap`: border + `radius-lg` + `bg-[var(--bg-elev-1)]`; thead cells
      11px/600/uppercase/0.08em-tracking/`fg-dim`; body cells 12×16px padding. Live: default shadcn
      `rounded-md border`, normal-case headers, transparent background.
- [x] Semantic badge colors: `green/blue/red/yellow/orange-500` classes → `--cdb-success` /
      `--cdb-info` / `--cdb-cherry-hi` / `--cdb-warning` tokens (all exist in `globals.css`) with
      the kit's 14% color-mix backgrounds. Cherry lands only on destructive verbs (`deleted`,
      `login_failed`) — consistent with the cherry-reservation rule.

Audit pane:

- [x] Entry count → mono 12px (`cdb-admin-count`); currently sans `text-sm`.
- [x] Timestamp cell → mono + middot separator (kit: `Jun 11 · 8:42 PM`); year handling is judgment
      call 1 below.
- [x] Column headers: "User" → "Member", "Metadata" → "Detail".
- [x] Metadata value separator `", "` → `" · "` (middot copy rule).
- [x] ID truncation: real ellipsis `…` not `"..."`; kit shows 6 chars (live 8 — either fine, keep
      the tooltip with the full ID).

Members pane:

- [x] **Add the missing bar** above the table: desc "Manage roles, reset passwords, and remove
      members." left, mono `N members` right (kit `cdb-admin-bar` + `cdb-admin-desc` +
      `cdb-admin-count`).
- [x] Empty state "No users found." → members wording.
- [x] "You" indicator → rounded-full pill (kit `cdb-admin-you`; live Badge is rounded-md).

Invite pane:

- [x] Button copy "Generate Code" → "Generate code" (sentence-case body copy).
- [x] Code chip: mono + border + `bg-elev-2` (kit `cdb-admin-code code`; live is `bg-muted`, no
      border, `font-medium` sans-ish).
- [x] `justGenerated` row highlight `bg-green-500/5` → success-token color-mix.

Mobile:

- [x] Tables scroll internally at ≤900px (shadcn `Table` ships an `overflow-x-auto` container —
      verify, don't assume) and 0px page overflow at 320/390/768/1440.

### Keep as-is (exceeds the kit or established deviations)

- shadcn `Select`s instead of the kit's styled native selects (established primitive-swap pattern).
- Role-select shield icons per role (app extra; kit is a plain select).
- Confirm dialogs, temp-password dialog + copy button, toasts, tooltips, motion row staggers — all
  app extras over the kit's static mock.
- 180-day duration option (kit lacks it).
- `—` placeholders in empty table cells (the kit itself does this; the em-dash rule is about prose).
- Admin gating redirect + loading skeletons (kit N/A).
- Page container `max-w-7xl` (1280px) vs kit `cdb-page-inner` 1200px — 80px apart on a page of wide
  tables; other pages' `max-w-5xl` would be too tight for 7 columns.

### Judgment calls (RESOLVED with the owner 2026-07-07)

1. **Audit timestamp year — year only when older.** Current-year entries match the kit exactly
   (`Jun 11 · 8:42 PM`); older entries add the year (`Jun 11, 2025 · 8:42 PM`). Pure formatter, TDD.
2. **Pagination — keep the shared `MediaPagination` as-is.** Structurally identical to the kit
   already; app-wide consistency wins. Intentional deviation from `cdb-admin-pagination`'s mono page
   info / "Prev"/"Next" labels.
3. **Verification account — temporarily bump `tester` to admin** on the dev DB for the headless
   pass, restore to moderator afterwards.

### Acceptance criteria

- [x] Masthead + issue line render with real counts; gold-active segmented tabs; all three tables in
      kit chrome with semantic badge colors; Members bar present
- [x] No "users" wording anywhere on the page (tabs, columns, empty states, tooltips, dialogs,
      toasts — the "Users" the headless check first flagged turned out to be the sidebar nav item
      from the already-shipped Sidebar pass, not this page)
- [x] `pnpm typecheck` / `pnpm lint` / `pnpm test` green (**612** — 4 new `format-audit-timestamp`
      tests on top of the 608 baseline)
- [x] Headless verification with an admin account (`tester` temporarily bumped to admin on the dev
      DB, restored to moderator after): 26/26 checks — masthead/issue-line/tabs presence, computed
      uppercase 11px table headers, mono counts/timestamps, pill badge radius, 0px overflow at
      320/390/768/1440, light + dark, no console errors (one 401 investigated: pre-login
      `/api/auth/me` check, pre-existing app-wide behavior, not this page)
- [x] Manual + feature-dev review reconciled (see Review outcome below); commit pending owner
      go-ahead
- [ ] Light mode readable, no broken tokens (owner visual pass)

### Owner visual pass fix (2026-07-07)

One finding from the owner's live pass: the masthead's bottom border and the issue line's rule sat
too close together — the kit's `.cdb-page-inner` flex column separates them with a 32px gap that the
app page lacked. Fixed with an `mt-8` wrapper around `IssueLine` (owner confirmed live). **The Users
page had the same drift** (same header + `IssueLine` sibling structure, no gap) — fixed same-day at
the owner's request with the identical `mt-8` wrapper in `users/page.tsx`'s `RosterShell` (its issue
line sits between the masthead and the roster list, so only the top gap changes; the roster spacing
below is untouched).

### Review outcome (2026-07-07)

`feature-dev` code-reviewer: **zero Critical/Important findings.** Confirmed the SWR dedup claim
(page-level `useAdminUsers`/`useInviteCodes` share keys with the panes' own calls), the `IssueLine`
contract (no regression risk to other consumers), the admin-only scope of `table-chrome.ts`'s
arbitrary variants, and that `getCodeStatus`'s extraction to `src/lib/admin/invite-code-status.ts`
is behavior-preserving. One sub-threshold (~40 confidence) flag — a **pre-existing em-dash** in
`TemporaryPasswordDialog`'s copy — was real and fixed same-session (sentence split, no em-dash),
same precedent as the games config-screen fix (`bdb199d`).

Found during my own live verification (things the text-only audit missed, echoing the Sidebar lesson
that kit-vs-code reading alone doesn't catch everything):

- **Entity column rendered raw `Game_session`** — the kit does `entity.replace("_", " ")`; live cell
  only had CSS `capitalize`. Fixed with `replaceAll("_", " ")`. Only visible once real
  `game_session` rows appeared in the live table.
- **Hidden "user" wording** in a tooltip ("Delete user"), confirm-dialog titles ("Change User Role",
  "Delete User"), and toasts ("Deleted user X") — not visible in a static render, caught while
  tracing the wording check. All moved to member/group phrasing.
- **Page-level admin hooks fired for non-admins** during the brief pre-redirect render (the original
  page only fetched after the role gate). Fixed by extracting `AdminContent` so the hooks only mount
  post-gate.

### Owner visual pass, second round (2026-07-07, post-commit `c47c1a2`)

Three more findings from the owner's live pass against the kit, all fixed and headless-verified
(computed-style measurement against the kit's own `screen-admin.html` render, not just kit.css):

- **Tab bar chrome didn't match `.cdb-up-tabs`.** Kit bar: 40px tall, 1px `--border` outline, 8px
  radius, 2px gap; triggers 32px, 12px/500 text, 14px side padding, 6px radius, 13px icons. Ours was
  the shadcn default (36px, borderless, 12px radius, 14px text, 16px icons). Fixed via
  `ADMIN_TABS_LIST_CLASS` + additions to `ADMIN_TAB_CLASS` in `admin/page.tsx`. Note: the list
  height override must be written `group-data-[orientation=horizontal]/tabs:h-10` (the primitive's
  own variant prefix) so tailwind-merge replaces its `h-9` — a plain `h-10` loses the cascade. **The
  profile page (`users/[id]`) renders the same kit component with the old chrome** — not touched
  here (out of the owner's ask), flagged as a candidate follow-up for consistency.
- **Members table started higher than the other two panes.** Audit/Invites lead with 36px control
  rows; Members' desc line was text-height only. Fixed with `min-h-9` on the Members bar so all
  three tables start at the same offset (measured 76px below the tab bar on all three). Owner call:
  the kit itself is _not_ uniform here (its Members/Invites bars are 45.5px from un-reset `<p>`
  margins, audit 34px) — we standardized instead of copying that artifact.
- **Table text should be near-white, not muted.** The kit's _rendered_ tables are `--fg` almost
  everywhere despite kit.css declaring muted colors:
  `.cdb-admin-table tbody td { color: var(--fg) }` (0,2,2) outranks the single-class
  `.cdb-admin-muted`/`.cdb-admin-time`/`.cdb-admin-id` rules (0,1,0), so those are dead rules on
  tds. Only elements with their own rule survive dim: the `@handle` line (11px `--fg-dim`) and the
  "You" pill (`--fg-dim`). Matched the render: dropped `text-muted-foreground` from all data cells
  across the three tables, ID cell white (was fg-dim), handle → 11px fg-dim, "You" → fg-dim. Bar
  text above the tables (desc/counts) stays muted — those rules target the elements directly in the
  kit, so they really render muted there.

### Owner visual pass, third round (2026-07-07, follow-ups from the second round)

Four owner-directed items, all fixed and verified live (typecheck/lint/612 tests green):

- **Admin header entrance animation removed** (owner call). Admin was the only page animating its
  masthead in (`motion.div` opacity/y); every other page renders statically. Removed the wrapper
  rather than animating the other pages — quiet utility surface, consistency wins.
- **Profile page tabs got the same kit `.cdb-up-tabs` chrome** as Admin (the follow-up flagged in
  round two): `PROFILE_TABS_LIST_CLASS` + trigger metric additions to `PROFILE_TAB_CLASS` in
  `users/[id]/page.tsx`, icons 16→13px. Measured live: 40px bordered bar, 8px radius, 2px gap,
  32px/12px triggers, 6px trigger radius, 13px icons — kit-exact.
- **Members role select widened `w-28` → `w-36` (144px)** so "Moderator"/"Member" render unclipped.
  Kit's `.cdb-admin-select-role` is 132px, but our trigger leads with a role icon the kit doesn't
  have. Owner confirmed 140px unclipped in a real browser; 144px keeps a cushion for font-metric
  variance (headless fallback font measured ~2px wider — the known Geist-in-headless gotcha).
- **Shared `MediaPagination` label "Previous" → "Prev"** to match the kit's admin pagination
  (`< Prev · Page N of M · Next >`). Owner explicitly OK'd the shared-component copy change (it also
  renders on Database) — this narrows the earlier "keep `MediaPagination` as-is" judgment call to
  structure/styling only; the label now follows the kit.
- **Sidebar admin nav tag got its missing chip chrome** (owner question → fix). The right-side
  "ADMIN" tag is the kit's access-gate marker (`.cdb-nav-admin-tag`), not duplication — ours had the
  type styles but rendered as bare text. Added the kit's pill (elev-3 bg, 2px/6px padding, full
  radius) plus its active-state variant (amber 16% bg + marquee text via `NAV_ACTIVE_CLASS`, needed
  because the resting elev-3 chip would vanish against the active row's elev-3 wash). Verified live
  in both states.
