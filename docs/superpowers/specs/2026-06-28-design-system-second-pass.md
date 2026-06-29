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
2. Database — to audit
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
