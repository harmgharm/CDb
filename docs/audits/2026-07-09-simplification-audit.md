# CDB Code Simplification Audit

**Scope:** full `src/` tree (app source only — tests/config/migrations excluded). **Mode:** audit
only — no code was changed. Six parallel passes: `lib/`, `hooks/`, `components/`, `app/api/`, `app/`
pages, and a cross-cutting duplication sweep over the whole tree. **Date:** 2026-07-09

This report merges overlapping findings from the six passes into single entries and notes which
passes independently confirmed each one — independent confirmation from an isolated directory pass
_and_ the cross-cutting pass is a strong signal the fix is real and worth prioritizing.

---

## How to read this

- **Severity** is about maintainability/risk impact, not effort. Several "high" items are large
  mechanical extractions (safe, just big); a couple are actual correctness risks (flagged
  explicitly).
- **Confirmed by** lists which of the 6 passes independently surfaced the same or overlapping
  finding.
- Nothing here has been applied. Pick what you want fixed and we'll do it as a separate, reviewable
  pass (by area, with commits between).

---

## Top priority (cross-cutting, highest leverage)

### 1. `getInitials` reimplemented in ~20+ files, with two diverging algorithms

**Severity: High** · Confirmed by: app pages, components (independently, both found ~19-20 sites)

The avatar-initials helper is redeclared in nearly every file that renders an
`Avatar`/`AvatarFallback` — games components, admin, sidebar, media cards, stats, user pages,
settings. Two different algorithms are in use (split-on-space-take-first-letters vs. `slice(0,2)`),
so different avatars in the app can render initials differently for the same name.

**Fix:** One `getInitials(displayName, username)` in `src/lib/users/`, pick one canonical algorithm,
replace all call sites. Consider also extracting a shared `<UserAvatar>` component since the
`<Avatar><AvatarImage/><AvatarFallback>` wrapper is copy-pasted ~25 times alongside it.

---

### 2. The three games (poster-reveal, rating-guess, year-guess) are ~90% duplicated code, three times over

**Severity: High** · Confirmed by: components, lib

This is the single largest duplication block in the app, spanning multiple layers:

- **`play-page-content.tsx`** (3 files, ~250-275 lines each) — idle→playing state machine,
  difficulty/rounds/time-limit selects, mode tabs, ranked logic, `RankedIndicator` — copy-pasted
  line-for-line except game-type string/icon/title.
- **`multiplayer-game.tsx`** (3 files, ~575-612 lines each) — entire Ably orchestration: all
  `useChannel` handlers, player memoization, fallback-timer machinery, round lifecycle, unmount
  cleanup — duplicated verbatim.
- **`solo-game.tsx`** (3 files, ~271-272 lines each) —
  `handleGuess`/`handleTimeExpired`/`handleNextRound`, phase guards, `playGuessSound` — ~80%
  identical. Also each redeclares its own local `ScoreHeader` even though an identical one is
  already exported from `games/multiplayer-banners.tsx`.
- **Engines** (`rating-guess.ts` / `year-guess.ts` in `lib/games/`) — same shape for every method
  (`calculateAccuracyScore`, `checkCorrectness`, `maskRoundData`), differing only in field name and
  score multiplier.
- **Pools** (`media-pool.ts` / `rating-pool.ts` / `year-pool.ts` in `lib/games/`) — identical 24h
  cache wrapper, identical TMDB/Jikan discover params, identical DB base-pool query, differing only
  in the projected field.

**Fix (staged):**

1. `useMultiplayerGameOrchestrator(gameId, roundTimerMs, …)` hook + thin per-game visual wrapper.
2. Shared `GameSetupPage` component parameterized by game metadata, replacing the 3
   `play-page-content.tsx` files.
3. Extract shared solo-game flow (hook or generic component); import `ScoreHeader` from
   `multiplayer-banners` instead of redeclaring.
4. `createGuessEngine(config)` factory for rating-guess/year-guess engines.
5. Generic `buildPool<T>(projectItem, dbQueryExtras)` factory for the three pool files.

This is a big lift but almost entirely mechanical and low-risk (behavior stays identical) — good
candidate to tackle in its own dedicated branch, game-type by game-type.

---

### 3. Every SWR mutation hook (~20 hooks, ~40+ call sites) hand-rolls the same pending/error/fetch pattern

**Severity: High** · Confirmed by: hooks, cross-cutting

`use-admin.ts`, `use-games.ts`, `use-sessions.ts`, `use-watchlist.ts`, `use-notifications.ts`,
`use-predictions.ts`, `use-recommendations.ts`, `use-media.ts`, `use-media-refresh.ts`,
`use-settings.ts`, `use-find-similar.ts`, `use-queue.ts` all repeat: `useState` pending flag →
`useCallback` → `fetchWithAuth` → `(await response.json()) as ApiResponse<T>` → branch on
`error === null` → `catch` → `finally` reset pending. The read path already has a shared `fetcher`
(`swr-provider.tsx`) but there's no mutation equivalent.

**Fix:** Add `mutateWithAuth<T>(url, init)` next to `fetchWithAuth`, and/or a
`useApiAction`/`useMutation` hook wrapping the pending-flag + error-state + try/finally boilerplate.
Collapses each hook to ~5 lines. This is the highest-value single change in `src/hooks/`.

Related smaller duplications folded into the same fix:

- Query-string builders (`buildAuditLogKey`, `buildQueryString`, `buildWatchlistKey`,
  `buildRecommendationKey`) all reimplement "URLSearchParams, skip undefined/empty" — consolidate
  into one `buildQuery(params)`.
- Notification/recommendation cache-invalidation blocks (`mutate(key.startsWith(...))` pairs)
  repeated 4-6× each — extract `revalidateNotifications`/`revalidateRecommendations` helpers.

---

### 4. API routes: auth-guard boilerplate in ~60 files + unguarded `req.json()` in 26 routes

**Severity: High (includes a real correctness gap, not just style)** · Confirmed by: app/api

- **Auth guard duplication:** ~67 occurrences of
  `const user = await getAuthUser(); if (!user) return errorResponse(...)` (and the admin variant)
  copy-pasted across nearly every route handler.
- **Unguarded body parsing:** 26 routes call `await req.json()` with no try/catch. A malformed or
  empty body throws _before_ Zod validation runs, producing a raw unstructured 500 instead of the
  project's standard `{ data, error, message }` shape. Only one route (`admin/invite-codes`) guards
  this today.
- **Duplicated `GameSessionResponse` construction** across `games/route.ts`,
  `games/[id]/start/route.ts`, `games/[id]/route.ts` — the full response object + `roundResponses`
  mapping is copy-pasted in all three with no shared builder.
- Player/game authorization logic (`authorizePlayer`/`authorizeView`) reimplemented per-route with
  the same "is this user in the game" check and error strings.

**Fix:** A `withAuth(handler)` / `withAdmin(handler)` wrapper in `src/lib/api/` that resolves the
user and short-circuits with the standard error, plus a `parseBody(req, schema)` helper that catches
JSON parse failures uniformly. Extract `buildGameSessionResponse`/`toRoundResponse` and
`authorizeGameAccess` into `src/lib/games/`. This is the highest-value fix in `app/api/` — it's both
a simplification and a correctness fix (uniform 400 instead of leaking 500s on bad input).

Also flagged: `stats/route.ts` runs 10 independent queries sequentially instead of `Promise.all`-ing
them (real latency cost, not just style); media/watchlist list routes duplicate filter-predicate
construction between the data query and the count query.

---

### 5. Recommendations engine: the same parse/dedup/score-average primitives copy-pasted across 6-8 files

**Severity: High** · Confirmed by: lib, cross-cutting (independently, both flagged the exact same
TMDB→candidate mapping duplication)

`src/lib/recommendations/{content,collaborative,group,filtered,similar,tmdb-recs,fallback}.ts` each
independently reimplement:

- **TMDB/Jikan → `RecommendationItem` parsing** (~15 near-identical blocks across 6 files) — same
  field mapping, differing only in the trailing score/recType/reasons.
- **Dedup-by-key builder** (`mal-`/`tmdb-` key construction) duplicated in 6 files.
- **Dedup-then-sort** logic (`deduplicateAndSort`/`deduplicateAndSlice`/`deduplicateCollaborative`)
  — same pattern, 4 files.
- **"Average score per string key" fold** (genre/director/cast scoring) — same reduce shape in
  `computeGenreScores`/`computeDirectorScores`/`computeCastScores`/`getUserTopGenre`/`computeSingleUserPreference`/`collectSimilarUserGenres`.
  `predictions/user-affinity.ts` already solved this generically — nothing else reuses it.
- **"Fetch N discover pages, filter watched, parse" loop** — movie/TV variants are byte-identical
  pairs in 3 different files.
- **Year-from-date-string parsing** (`x.slice(0,4)`) duplicated ~11× despite an existing (but
  private) `parseYear` helper in `lib/api/metadata.ts`.

**Fix:** Extract shared `recommendations/parse.ts` (TMDB/Jikan → candidate mapper) and
`recommendations/dedupe.ts` (key + dedupe-and-sort), a generic `averageByKey()` fold, and export
`parseYear` for reuse. This absorbs the majority of the duplication across the whole recommendations
module in one coherent, low-risk change.

Related: `predictions/signals.ts` independently reimplements the collaborative-similarity logic
(`findSimilarUsers`) that already exists in `recommendations/collaborative.ts` — same
Pearson-correlation-based "similar user" query, duplicated rather than shared. Two copies of the
same 100/150-minute runtime-bucketing threshold also exist (`signals.ts` vs `user-affinity.ts`) and
must be kept in sync manually.

---

## Correctness risks worth calling out specifically

These aren't just style — they're places where duplication has already caused (or could cause)
actual divergent behavior:

- **`predict-batch.ts` has a private byte-identical copy of `computeVerdict`/`computeConfidence`**
  that are already exported from `predict.ts`. The verdict/confidence thresholds (`>=8/6.5/5`, etc.)
  can silently drift out of sync between the single-item and batch prediction paths if one copy is
  edited and not the other. _(cross-cutting pass)_
- **`formatRuntime` has already diverged**: 3 copies render `"90m"`, one
  (`media-preview-dialog.tsx`) renders `"90 min"` — same function name, different output, in the
  same app. _(components + cross-cutting, independently)_
- **`normalizeTitle` name collision**: `lib/games/matching.ts` exports a `normalizeTitle` that
  strips articles/punctuation; `lib/recommendations/watched.ts` has a private `normalizeTitle` that
  only lowercases+trims. Same name, different strictness — a future import of the wrong one would
  silently break title matching. _(cross-cutting)_
- **`toSearchResult` diverges on null handling**: `watchlist-card.tsx`'s version returns `null` on
  missing IDs; `recommendation-card.tsx`'s version defaults to `0` — same conversion, different
  edge-case behavior. _(components)_
- **26 API routes have unguarded `req.json()`** — malformed input produces raw 500s instead of the
  app's standard structured error response. _(app/api)_

---

## Everything else, by area

### `src/app/` pages

- Login/signup forms (`(auth)/login`, `(auth)/signup`) are near-identical boilerplate (submit flow,
  error state, redirect) — extract a shared `useAuthForm`/`submitAuth` helper. **Medium-high.**
- `formatJoinDate` byte-identical between `users/page.tsx` and `users/[id]/page.tsx`. **Medium.**
- Detail-page loading/not-found/error gate duplicated verbatim between `database/[id]` and
  `users/[id]` — extract a `<DetailStateGate>` wrapper. **Medium.**
- `RoleBadge`/`ProfileRoleBadge` are the same component with divergent styling only — consolidate
  with a `variant` prop. **Medium.**
- Landing page (`app/page.tsx`) reimplements its own auth-probe-with-refresh `useEffect` in parallel
  with the existing `useRedirectIfAuthenticated` hook — the two can drift (landing has a refresh
  retry step the hook doesn't). **Medium.**
- `admin/page.tsx` gates client-side (`useAuth` + `useEffect` redirect + skeleton) where the
  `play/*` pages already show the cleaner pattern (`requireAdmin()` server-side + thin wrapper).
  **Medium.**
- `(main)/layout.tsx` is marked `"use client"` but only composes already-client provider components
  — likely doesn't need the directive itself (verify before changing, may have been intentional for
  sidebar SSR/cookie behavior). **Low.**
- Roman-numeral/issue-date formatting lives inline in `database/page.tsx` instead of `src/lib/`.
  **Low.**

### `src/hooks/`

- `useWatchlistPredictions` uses the discouraged `useEffect` + `setState` + manual-cancellation-flag
  fetch pattern instead of SWR — the exact anti-pattern the project convention says to avoid.
  **Medium.**
- `useMediaSearch`/`useMediaRefresh` hand-roll request-staleness guards (`requestIdRef`,
  `cancelledReference`) that SWR would handle natively. **Medium.**
- `useDeleteMedia` lives in `use-sessions.ts` instead of `use-media.ts` — pure discoverability
  issue. **Low.**
- Three overlapping "refresh recommendations" hooks (`useRefreshFilteredRecommendations`,
  `useRefreshRecommendations`, `useRefreshSection`) could merge into one parameterized hook.
  **Medium.**

### `src/components/`

- Watchlist add/remove-with-toast + optimistic local state hand-rolled inline in both
  `watchlist-card.tsx` and `recommendation-card.tsx` instead of reusing
  `add-to-watchlist-button.tsx`'s logic — extract `useWatchlistToggle()`. **Medium.**
- `formatDate` (long form) duplicated across 4 components with 3 diverging option sets (some include
  `timeZone: "UTC"`, some don't; one uses `month: "long"`). **Medium.**
- `find-similar-content.tsx` hand-rolls a debounce instead of using the existing
  `use-debounced-search.ts` hook. **Medium.**
- `WatchlistCardLink`'s three-way Link/fragment/clickable-div conditional plus 12 props forwarded
  into an embedded preview dialog — prop-drilling smell, overlaps with the same wiring in
  `recommendation-card.tsx`. **Low.**
- Unused `type` prop on `MediaInfoRow` (dead required prop, stale comment). **Low.**
- 12 copies of the same "Loading game…"/"Preparing round…" centered-div blocks across all 6 game
  components (folds into the games consolidation above). **Low.**

### `src/lib/`

- `stats/queries.ts`: `fetchGenreStats`/`fetchDirectorStats`/`fetchCastStats` (and their
  `format*Stats` companions) share one raw-SQL template, differing only in the lateral-join
  expression and key alias — consolidate into one builder. **Medium.**
- `auth/session.ts`: `getAdminUser`/`getModeratorUser`/`requireAdmin`/`requireModerator` each
  re-check the role after fetching the user — could share a `getUserWithRole(predicate)` core.
  **Low** (current code is already clear).
- `api/response.ts`: `successResponse(data: unknown, ...)` discards the type info `ApiResponse<T>`
  is meant to carry — make it generic. **Low**, type-safety only, no runtime change.
- Dead `pearsonCorrelation` re-exports in `collaborative.ts`/`index.ts` with no importers. **Low.**
- `getOrComputeRecommendationsWithMeta` calls `computeGroupRecommendations()` with no argument,
  silently skipping the `COMPUTE_POOL_SIZE = 80` constant every other type uses (defaults to 60
  instead) — likely unintentional inconsistency, worth confirming. **Low-medium.**

### Validation schemas

- `mediaTypeSchema` (canonical, in `media.schema.ts`) is bypassed by inline
  `z.enum(["movie","tv","anime"])` redefinitions in 4+ other validation files (watchlist, dismissal,
  similar, prediction schemas) — adding a media type in the future would require touching every
  copy. **Medium.**

### Realtime (Ably)

- Game channel names (`game:${id}`) and event-name strings (`"player-guessed"`, `"rematch-created"`,
  etc.) are raw duplicated string literals between publisher and subscriber code, unlike the queue
  feature which centralizes `QUEUE_CHANNEL` as a named constant. A typo would silently break
  realtime with no type error. **Low-medium.**

---

## Suggested order of attack

If you want to tackle this incrementally rather than all at once, roughly in order of value-to-risk
ratio:

1. **API routes** (#4) — `withAuth`/`withAdmin` wrapper + body-parse guard. Highest-value: fixes a
   real correctness gap (unstructured 500s) and touches nearly every route with a mechanical,
   low-risk change.
2. **`getInitials` + avatar consolidation** (#1) — very mechanical, zero behavior-risk, immediate
   codebase-wide cleanup.
3. **Hooks mutation helper** (#3) — `mutateWithAuth`/`useApiAction`. Big line-count win, low risk
   since it's a pure extraction of an already-consistent pattern.
4. **Recommendations parse/dedupe consolidation** (#5) — highest structural value in `lib/`,
   self-contained to one module.
5. **Predictions duplicate-verdict fix** (correctness risk callout) — small, but worth doing on its
   own since it's an actual bug-in-waiting.
6. **Games triple-duplication** (#2) — biggest total line reduction in the app, but also the biggest
   single lift; good candidate for its own dedicated branch, done one game-type extraction at a time
   with tests/manual verification between each step given the real-time multiplayer logic involved.
7. Everything else in "Everything else, by area" — smaller, can be picked off opportunistically or
   bundled with nearby work.

Let me know which of these you'd like to actually implement, and I'll scope it as a separate,
reviewable pass (one area/commit at a time, as discussed).
