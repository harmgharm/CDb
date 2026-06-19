# CDb Design System Rollout

**Status:** Draft (working document — phases planned in-chat as we pick them up) **Date:**
2026-05-22 **Owner:** dev

---

## 1. Context & Goals

CDb shipped its MVP on vanilla shadcn/ui defaults (pure black/white neutral, no real brand). A full
design system now exists in `/CDb Design System/` — a warm cinematic identity ("screening room with
friends"), marquee-amber primary, editorial typography moments, and a 10-screen UI kit covering
every authenticated and public surface.

This project rolls the system into the production Next.js app.

**Goals:**

- Replace the neutral shadcn theme with the warm-dark / marquee-amber identity across every surface
  in one coherent pass.
- Introduce editorial moments (Instrument Serif mastheads, italic accents, conversational filter
  sentences, magazine-cover headers) on the surfaces that benefit from them.
- Keep utility surfaces (dashboard rows, settings forms, activity feed, admin tables) quiet and
  dense.
- Preserve everything that already works: shadcn component APIs, database schema, auth, API routes,
  real-time presence, recommendations engine, game logic.

**Non-goals:**

- Adding new product features (this is a pure visual revamp).
- Mobile-first redesign (mobile gets a dedicated late phase — see Phase 11).
- Enforceable performance budgets via LHCI (separate project if desired later).
- A formal accessibility audit beyond verifying WCAG AA contrast on the foundation tokens.
- Rebuilding the in-game UI for the three games (out of scope — only the Play hub gets touched).

---

## 2. Decisions Log

Captured from brainstorming. Pin these so future sessions don't relitigate.

| Decision            | Choice                                                                        | Notes                                                                                         |
| ------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Rollout shape       | Foundation first, then per-screen                                             | Small reviewable PRs in README order                                                          |
| Editorial intensity | Editorial on landing/database/for-you/users/auth; utility everywhere else     | Per README's surface-mode split                                                               |
| User taglines       | Auto-generated, stat-leaning factual, **computed on read (no DB column)**     | E.g. "Sci-fi devotee. 47 watched, 8.1 avg." Refresh on profile load, cache later only if slow |
| Fonts               | Instrument Serif + JetBrains Mono via `next/font/google`, keep Geist for UI   | Self-hosted, no Google runtime request                                                        |
| Favicon             | Swap to design system's italic amber "b"                                      | Drop `assets/cdb-favicon.svg` + PNGs into `src/app/` per App Router conventions               |
| Light mode          | Dark first, light works but not polished                                      | Per-screen acceptance criteria includes "reasonable in light", no separate sweep              |
| Sidebar Up Next     | Reuse in-progress session → top-of-watchlist fallback (no schema change)      | Real "scheduled sessions" feature is a future project                                         |
| Games               | All neutral, cherry red reserved for "live now" multiplayer signal only       | Per game name + icon do the differentiation                                                   |
| Performance budgets | Out of scope                                                                  | Watch for obvious regressions only                                                            |
| Accessibility       | WCAG AA contrast verified on foundation tokens in Phase 0                     | Keep current semantic/keyboard/focus practices                                                |
| Bundle size         | No formal budget; verify font loading is `swap` + self-hosted in Phase 0      |                                                                                               |
| Em-dashes           | **Do not use em-dashes in user-facing copy**                                  | Reads as AI now. Use sentence breaks, commas, or `&middot;` (·) for inline separation         |
| Spec workflow       | This is the single working document; per-phase implementation planned in-chat | No separate implementation plan written upfront                                               |

---

## 3. Cross-cutting Constraints

These apply to **every** phase.

### Do not touch

- shadcn primitives in `src/components/ui/` (Button, Badge, Card, Sidebar, Dialog, etc.). Their APIs
  and structure stay; they pick up new tokens automatically via the `@theme inline` block in
  `globals.css`.
- Database schema, API routes, auth flow, real-time/Ably presence, recommendations engine, games
  logic.
- `lucide-react` as the icon system.

### Required everywhere

- **Icons:** Lucide only. No emoji. No custom SVGs (copy a Lucide path if missing).
- **Voice:** "friends", "the group", "everyone" in user-facing copy. Never "users".
- **Casing:** Title Case for nav, page titles, card titles. Sentence case for body, helper text,
  toast messages. UPPERCASE only on `.eyebrow` micro-labels.
- **Punctuation:** No em-dashes in user-facing copy. Use sentence breaks, commas, or `&middot;` (·)
  as inline separator.
- **Numbers:** Raw integers for counts ("48 titles"). One decimal for ratings ("8.4"). Always pair
  stats with a unit/label.
- **Star icon:** Always `fill-amber-500 text-amber-500` regardless of theme.
- **Cherry red:** Reserved exclusively for "live multiplayer" signals. Existing destructive UI
  patterns stay as they are (not converted to cherry).

### Each phase must

- Not regress unrelated screens (per-phase smoke check on at least one other screen).
- Look "reasonable" in light mode. Acceptance bar: no broken contrast, nothing illegible, no missing
  tokens. Polish is not required.
- Use the four editorial primitives once they exist:
  - `<EditorialMasthead>` from Phase 6 onward.
  - `<ConversationalFilters>` from Phase 6 onward.
  - `<MagazineCoverHeader>` and `<IssueLine>` from Phase 8 onward.

### Copy is reference, not canonical

The design system's example copy is **direction, not law**. Adapt voice while preserving content
fundamentals (group-aware, no "users", sentence case, no em-dashes). Replace anything that doesn't
land — for example, the README's "A screening room your group keeps coming back to" tagline is a
starting point, not a requirement.

### Dependencies

No new runtime dependencies beyond `Instrument_Serif` + `JetBrains_Mono` via `next/font/google`. We
already have everything else (motion, lucide-react, radix, etc.).

### Verification approach

Acceptance criteria are written to be self-verifying ("hero shows asymmetric poster stack with film
grain on dark surface"). Inline "verify by:" hints appear only where the check is non-obvious (e.g.,
"verify by: DevTools Network tab shows no `fonts.googleapis.com` request").

---

## 4. Surfaces with no dedicated phase

These exist in the app but don't appear in the kit. They inherit the foundation tokens via
`@theme inline` and need no dedicated phase.

- **Admin** (`src/app/(main)/admin/page.tsx`, `src/components/admin/*`) — tables, forms, audit log.
  Pure utility surface. Foundation carries it.
- **Notifications** (`src/components/notifications/*`) — bell + dropdown + items. Utility chrome.
  Foundation carries it. Voice may want a light pass to align verbs with the activity feed style,
  but that's a follow-up, not a phase.
- **Watchlist** (`src/components/watchlist/*`) — card, status badge, section, "Add to" button.
  Poster cards pick up the new shadow + bottom-gradient treatment from foundation. Status badge
  color mapping (planning / watching / scrapped) is addressed in Phase 0.

---

## 5. Phases

Each phase is self-contained. Plan the implementation in-chat when picking it up.

---

### Phase 0 — Foundation: tokens, fonts, favicon

**Goal:** Replace the neutral shadcn theme with the warm-dark / marquee-amber identity. After this
phase every existing component looks "new-but-rough" without any structural changes.

**Scope (in):**

- Replace `:root` and `.dark` blocks in `src/app/globals.css` with the values from
  `CDb Design System/colors_and_type.css`. Map to existing `@theme inline` tokens
  (`--color-background`, `--color-primary`, etc.) so shadcn primitives pick them up.
- Add full `--cdb-*` brand token set (marquee, cherry, cream, velvet, ink scale, media-type accents,
  friends, star, semantic) as CSS custom properties.
- Add radii / shadows / spacing / motion tokens from the design system.
- Swap fonts in `src/app/layout.tsx`: add `Instrument_Serif` (display, 400 + italic) and
  `JetBrains_Mono` (mono); keep `Geist` for sans. Wire `--font-display`, `--font-sans`,
  `--font-mono` in the `@theme inline` block.
- Delete `src/app/favicon.ico`. Copy `CDb Design System/assets/cdb-favicon.svg` →
  `src/app/icon.svg`, `cdb-favicon-32.png` → `src/app/icon.png`, `cdb-favicon-180.png` →
  `src/app/apple-icon.png`.
- Update `metadata.title` and `metadata.description` in `layout.tsx` to brand-aligned copy.
- Verify watchlist status badge colors (planning / watching / scrapped) map cleanly to the new
  palette. Tweak if needed.
- Verify foundation tokens hit WCAG AA contrast: `--fg` on `--bg`, `--fg-muted` on `--bg`,
  `--primary-fg` on `--primary`, `--cdb-marquee` text on `--bg`. Adjust the offending token if any
  combo fails ≥4.5:1 (text) / ≥3:1 (large text or UI elements).

**Scope (out):**

- Any screen-level rebuild. Pages keep their current markup; they just look different.
- New editorial primitives.
- Sidebar changes (separate Phase 1).
- Removing the existing `animate-shake` / `animate-ticker` utilities — they stay.

**Constraints:**

- Don't change any component file under `src/components/ui/`.
- Don't change any page or feature component.
- Light mode token block must be defined even if undertested.

**Acceptance criteria:**

- [ ] `pnpm typecheck && pnpm lint && pnpm test` pass.
- [ ] Dev server starts, every existing route renders without console errors.
- [ ] Foundation tokens pass WCAG AA contrast checks (record results in PR description).
- [ ] DevTools Network tab shows no runtime request to `fonts.googleapis.com`.
- [ ] Favicon shows the italic amber "b" in browser tab.
- [ ] Watchlist status badges remain readable and visually distinct in both themes.
- [ ] Light mode does not break any screen (no missing tokens, no illegible text).

**Open questions:** None.

---

### Phase 1 — Sidebar polish

**Goal:** Apply the "CD*b*" wordmark and Up Next mini-card to the sidebar.

**Scope (in):**

- Replace the "CinemaDB / Movie tracker" header in `src/components/app-sidebar.tsx` with the "CD*b*"
  wordmark (italic amber `b`) plus a one-line subtitle.
- Add an "Up Next" mini-card above the Navigation group:
  - Poster thumbnail (from media data).
  - Pulsing amber dot.
  - Dynamic label: "In progress" if an in-progress session exists, else "Up next in your watchlist".
  - Tap target navigates to the relevant media detail page (or watchlist if empty).
- New `useUpNext()` SWR hook that returns `{ media, source: "in-progress" | "watchlist" | null }`.
  Source order: most recent in-progress session for current user → top of current user's watchlist →
  null. No new API route; reuses existing session and watchlist endpoints.
- Refine the existing online-users section to match the kit's quieter row treatment.

**Scope (out):**

- Real "scheduled sessions" feature (future project).
- Sidebar collapse / mobile drawer behavior (Phase 11).

**Constraints:**

- Sidebar primitive (`src/components/ui/sidebar.tsx`) must not change.
- Empty state (no in-progress, empty watchlist) must hide the card gracefully — never show a broken
  placeholder.

**Acceptance criteria:**

- [ ] Sidebar header shows "CD*b*" with italic amber `b`.
- [ ] Up Next card renders for a user with a watchlist entry (verify with seed data).
- [ ] Up Next card hides cleanly when both source pools are empty.
- [ ] Pulsing amber dot uses motion tokens (`--dur-base`, `--ease-in-out`), no jitter.
- [ ] Nav active state uses marquee amber (inherited from Phase 0 tokens).
- [ ] Light mode: sidebar readable, Up Next card readable, no broken contrast.

**Open questions:** None.

---

### Phase 2 — Tagline derivation utility

**Goal:** Ship a `deriveTagline(user, stats)` function and wire it into user API responses, so Phase
8 can consume it without further plumbing.

**Scope (in):**

- New module (likely `src/lib/users/tagline.ts`) exporting `deriveTagline(user, stats): string`.
  Stat-leaning factual style, Letterboxd-bio energy. Templates work off data we already collect:
  - Top genre + watch count + average rating (e.g. "Sci-fi devotee. 47 watched, 8.1 avg.")
  - Picker tendency (e.g. "Picked 12 nights this year. Mostly anime.")
  - Rating personality (e.g. "Generous rater. Averages 7.8.")
  - Media-type lean (e.g. "Mostly anime. 92% by hour.")
  - Recent streak (e.g. "On a horror streak. 6 of the last 8.")
  - New-user fallback (e.g. "Just joined. No ratings yet.")
- Pick template via simple priority rules (recent streak > genre devotee > picker tendency > rating
  personality > media lean > new-user). Documented inline.
- Unit tests (`src/lib/users/tagline.test.ts`) covering each branch with synthesized stats fixtures.
- Wire into `/api/users/[id]` and `/api/users` responses as a `tagline: string` field.
- Compute on read; no caching, no DB column.

**Scope (out):**

- Any UI consumption (Phase 8).
- A `user_taglines` cache table. Only add if profile load measurably slows.

**Constraints:**

- No DB schema change.
- Computation must be O(1) extra DB queries per user. Reuse the stats already collected for the
  profile view.
- No em-dashes in template output (one period per phrase; sentence-case after the period is fine for
  stat fragments).

**Acceptance criteria:**

- [ ] `deriveTagline` returns a non-empty string for every fixture in the test suite.
- [ ] `/api/users/[id]` response includes a `tagline` field (verify with a manual curl).
- [ ] `/api/users` list response includes `tagline` per user.
- [ ] All branches covered by tests; tests pass.
- [ ] No regression on the existing users/profile pages (they ignore the new field until Phase 8).

**Open questions:**

- How many decimal places in averages: one (8.1) or two (8.13)? Default to one (matches the existing
  convention). Confirm when implementing.

---

### Phase 3 — Landing page

**Goal:** Rebuild the public landing (`src/app/page.tsx`) as the brand statement piece.

**Scope (in):**

- Asymmetric poster hero: three large foreground posters (rotated ±3–7°), three smaller blurred
  background posters. Use real TMDB-style data if available; placeholders otherwise.
- Film grain overlay (`.cdb-grain` SVG `feTurbulence`, ~22% opacity, `mix-blend-mode: overlay`,
  6-step keyframe shift).
- "CD*b*" wordmark moment at hero scale (Instrument Serif clamp, italic amber `b`).
- Tagline (replace "A screening room your group keeps coming back to" — write something better
  during implementation).
- Hero stagger animation (title → tagline → stats → CTAs, matching the existing pattern).
- Recently-watched ticker (existing `animate-ticker` utility) restyled.
- Feature cards with the 10% / 5% color washes (purple / blue / amber / emerald). No bluish- purple
  gradients on buttons.

**Scope (out):**

- Editorial primitives (none used here — landing is a one-off).
- Marketing site separation (we are the marketing site).

**Constraints:**

- No grain/noise on small panels — only the full-bleed hero.
- Hero must remain legible without the radial + vertical scrim being heavy enough to flatten the
  posters.
- CTAs (Log in, Sign up) are primary marquee + outline pair.

**Acceptance criteria:**

- [ ] Asymmetric poster stack renders with the documented rotations and blur split.
- [ ] Film grain visible but not distracting on the hero only.
- [ ] Wordmark renders with italic amber `b`.
- [ ] Hero stagger animation plays once on page load.
- [ ] Ticker scrolls smoothly at 30s linear infinite.
- [ ] Light mode: hero remains readable; if the cinematic treatment doesn't translate, fall back to
      a static warm-cream variant. Document the fallback in PR.
- [ ] Mobile (≥900px): hero collapses to a single-column variant. Below 900px is Phase 11.

**Open questions:**

- Hero pattern restraint: should we offer a more restrained variant (single poster wallpaper panel,
  copy on the side) per the README's question 3? Default to the asymmetric stack; reassess after
  seeing it on real data.

---

### Phase 4 — Auth (login + signup)

**Goal:** Apply the warm-dark identity to `(auth)/login/page.tsx` and `(auth)/signup/page.tsx`.

**Scope (in):**

- Wordmark above the form ("CD*b*" lockup at moderate scale).
- Warm-dark surface, marquee primary CTA.
- Form inputs follow new token set (focus ring marquee, border-strong on focus).
- Auth layout (`(auth)/layout.tsx`) updated if needed for the new background treatment.
- Subtle film grain optional on the auth split panel.

**Scope (out):**

- Auth flow logic, validation, error handling, redirect behavior. All preserved.
- Password reset / forgot-password screens if they exist — handle separately if needed.

**Constraints:**

- Auth API calls and error states must continue to work without regression.
- The bfcache redirect fix from commit `fa4e9c1` must continue to function.

**Acceptance criteria:**

- [ ] Login page wordmark, surface, primary CTA all use new tokens.
- [ ] Signup page matches.
- [ ] Error states still display correctly with new colors (semantic `--cdb-danger`).
- [ ] Form focus rings visible against the dark surface.
- [ ] Light mode: forms remain usable.

**Open questions:** None.

---

### Phase 5 — Dashboard (home)

**Goal:** Rebuild `src/app/(main)/home/page.tsx` to set the in-app tone.

**Scope (in):**

- Editorial header: dynamic "Tuesday at CDb" style (day of week + brand). Instrument Serif at
  page-title scale (44px).
- New `<NowShowing>` component (`src/components/dashboard/now-showing.tsx`): latest 2 sessions
  classified as rated / in-progress. The upcoming session is intentionally NOT shown here. It lives
  in the sidebar Up Next mini-card (shipped in Phase 1), so duplicating that poster moment on the
  dashboard would be redundant. The editorial header subtitle surfaces the next session in copy
  instead.
- Replace `<StatsOverview>` with a compact stat strip: single bordered card, 7 cells (Group avg ·
  Movies · TV · Anime · Sessions · Ratings · Hours), divider lines. Same data, different layout.
  Ratings (total ratings logged) is restored as a cell from the old prod stats.
- Activity feed stays utility (no editorial typography on rows).

**Scope (out):**

- Editorial primitives (none here — this is a dashboard, not a magazine spread).
- New stats. Same data, restyled.
- A standalone "Headline row" component. An early kit draft had one (Watch Streak / Highest Rated /
  Most Divisive / Currently Airing); it was dissolved in the current design system and there is no
  `headline-row.tsx` to build. See the decisions below.

**No Headline row (resolved):**

The kit's old top-level Headline row was cut and its contents redistributed. Pin these so we don't
relitigate:

- **Currently Airing** — cut. The app does not track airing status, so there is no data to surface.
- **Highest Rated / Most Divisive** — cut from a top-level position. They duplicate the Ratings
  sub-section that already lives inside the Deep Cuts tabs lower on the page.
- **Watch Streak** — folded into the new `viewing-habits.tsx` card as its streak header (a 14-day
  streak header sitting above the 7-day watch-pattern bar chart), not a separate hero card. This
  card replaces the earlier standalone `watch-pattern.tsx` plan. The meta line label is **"Avg
  start"** (the literal `avgStartTime` field), not the earlier cutesy "Lights down" — that label was
  de-corned in the design system and "Lights down" no longer appears anywhere in the kit.

**Constraints:**

- `<StatsOverview>` consumers (if any other route uses it) must continue to work, or be migrated in
  the same PR.
- Activity feed item markup unchanged — only the surrounding chrome.

**Acceptance criteria:**

- [ ] Header shows day-of-week + "CDb" in Instrument Serif.
- [ ] Now Showing card renders the two latest rated / in-progress sessions with correct
      classification (upcoming session is not shown here, it lives in the sidebar Up Next card).
- [ ] Compact stat strip shows 7 cells (Group avg, Movies, TV, Anime, Sessions, Ratings, Hours),
      dividers between cells.
- [ ] Activity feed unchanged structurally; picks up new tokens.
- [ ] Light mode: dashboard readable, no broken stats.

**Open questions:**

- Does the "Tuesday at CDb" greeting feel right, or should it be something less cute? Decide when
  implementing — write 2–3 alternatives and pick.

---

### Phase 6 — Database

**Goal:** Showcase editorial surface. Build `(main)/database/page.tsx` with the masthead, Featured
band, and conversational filters. Extract two reusable primitives.

**Scope (in):**

- "The _collection_" masthead with italic amber accent.
- Italic lede paragraph below the masthead.
- "Issue #N · Month MMXXVI" eyebrow line (real session count + current month).
- New `<EditorialMasthead>` primitive (`src/components/editorial/editorial-masthead.tsx`) extracted
  from this work. API kept minimal until a second consumer (Phase 7) shows what's actually shared.
- New `<ConversationalFilters>` primitive (`src/components/editorial/conversational-filters.tsx`).
  Sentence-shaped filter sentence:
  `"The full archive, *everything*, *movies*, *tv*, *anime*, sorted by *recently watched*."` with
  each italic word as an inline clickable filter. Replaces `media-filters.tsx`. Same filter state,
  different presentation.
- New `<FeaturedBand>` (`src/components/database/featured-band.tsx`): top-rated for current month +
  supporting cards stack. 56px serif rating number.

**Scope (out):**

- Filter logic. State stays in `useMediaFilters` or wherever it lives.
- Media detail page (Phase 10).

**Constraints:**

- `<EditorialMasthead>` and `<ConversationalFilters>` APIs must be simple enough that Phase 7 can
  consume them without surprise refactors. If the API would need to change to fit Phase 7, do the
  extraction during Phase 7 instead.
- Conversational filter sentence must remain accessible: each clickable word is a real `<button>`
  with a visible focus ring and an `aria-label`.
- No em-dashes in the sentence. Use commas for list separation as shown above.

**Acceptance criteria:**

- [ ] Masthead renders with italic accent on "collection".
- [ ] Featured band shows current month's top-rated with a 56px serif rating.
- [ ] Conversational filter sentence reads naturally and each italic word toggles its filter.
- [ ] Filter state synchronizes with URL or wherever it currently lives.
- [ ] Light mode: masthead, lede, filter sentence all readable.

**Open questions:**

- Should "Issue #N" use literal session count, or current month index, or some other counter? Decide
  when implementing.

---

### Phase 7 — For You (recommendations)

**Goal:** Rebuild `(main)/recommendations/page.tsx`. Reuse Phase 6 primitives.

**Scope (in):**

- "For you" masthead via `<EditorialMasthead>`.
- Conversational rec filters via `<ConversationalFilters>` (same primitive as database, with
  different filter options: type / genre / decade).
- Numbered rec sections (01 / 02 / 03 …) wrapping each `<RecommendationSection>` with the numbered
  chrome.
- Section asides: friend stack avatars for collaborative sections, "Source: TMDB" tag for
  TMDB-sourced sections.
- "Still warming up" banner for non-personalized state: asymmetric poster collage + grain, replaces
  the current small Card-based progress block.

**Scope (out):**

- Recommendation logic, weighting, signals. All preserved.
- Find-similar (separate component, no changes needed).

**Constraints:**

- Rec engine API responses unchanged.
- "Still warming up" must convey the same progress info (e.g., "X / 10 rated to unlock
  personalized") as the current block.

**Acceptance criteria:**

- [ ] "For you" masthead renders via reused primitive.
- [ ] Conversational filters work identically to Database, just different options.
- [ ] Numbered chrome on each rec section visible.
- [ ] Section asides render correctly per source type.
- [ ] "Still warming up" banner renders for users with < threshold ratings.
- [ ] Light mode: all editorial elements legible.

**Open questions:** None.

---

### Phase 8 — Users + User Profile

**Goal:** Rebuild `(main)/users/page.tsx` and `[id]/page.tsx`. Extract two more primitives. Consume
the tagline utility from Phase 2.

**Scope (in):**

- Users list as editorial roster rows: roster number + avatar + name + italic auto-generated
  tagline + stats + arrow. Not a grid.
- New `<IssueLine>` primitive (`src/components/editorial/issue-line.tsx`): uppercase mono "ROSTER ·
  MAY MMXXVI" with a flex-fill horizontal rule between left and right parts.
- New `<MagazineCoverHeader>` primitive (`src/components/editorial/magazine-cover-header.tsx`):
  large display name + italic tagline
  - italic-amber issue number + meta row + avatar with online pill.
- Profile page header rebuilt to use `<MagazineCoverHeader>`.
- Rating distribution histogram (`src/components/users/rating-distribution.tsx`): existing
  component, restyle bars to highlight the user's avg bar in `--primary`.
- Consume the `tagline` field from Phase 2's API changes.

**Scope (out):**

- User stats logic, rating distribution computation. Restyle only.

**Constraints:**

- Tagline rendering must handle a `null` or empty string gracefully (omit the italic line, not
  render an empty `<em>`).
- Roster numbers are display-only — not stable IDs.
- Online pill must reflect real Ably presence (already wired).
- The profile page wrapper (`.cdb-up-page` in the kit) needs `overflow-x: clip`. The magazine-cover
  header stacks full-bleed absolute layers including a `blur(80px)` backdrop, which bleeds a few px
  of horizontal overflow and triggers a flickering horizontal scrollbar. This is a structural
  consequence of the blurred-backdrop design, not a kit artifact, so it will reproduce in any
  faithful build. Use `clip` (not `hidden`) so no scroll container is established that could break
  sticky/anchored children.

**Acceptance criteria:**

- [ ] Users list renders as rows with number + avatar + name + tagline + stats + arrow.
- [ ] Each user's tagline reflects their real data.
- [ ] Profile header renders as magazine cover layout with 88px serif name.
- [ ] Rating distribution highlights the user's average bar in marquee amber.
- [ ] Online pill works for online and offline users.
- [ ] No horizontal scrollbar / flicker on the profile page (`overflow-x: clip` applied to the page
      wrapper).
- [ ] Light mode: roster and profile remain legible.

**Open questions:**

- Should the issue line use a real "issue number" (e.g., total sessions across the group) or be a
  fixed string per month? Decide when implementing.

---

### Phase 9 — Settings

**Goal:** Rebuild `(main)/settings/page.tsx` with "The fine print" header + magazine rail.

**Scope (in):**

- Editorial header: "The fine print" via `<EditorialMasthead>`.
- Two-column layout: sticky left rail (Profile / Password / Notifications / Sign Out) + right pane
  that swaps content.
- Forms themselves stay quiet utility on top of existing shadcn `<Input>` / `<Label>` / `<Switch>`.

**Scope (out):**

- Settings logic, notification preferences, password change flow. All preserved.
- Adding a tagline editor (we're not letting users edit taglines per the Phase 2 decision).

**Constraints:**

- Existing form submission and validation behavior must continue to work.
- Sign Out lives in the left rail (matches kit) — the existing sidebar user menu Sign Out also
  stays.

**Acceptance criteria:**

- [ ] Editorial header renders.
- [ ] Left rail sticks correctly on scroll.
- [ ] Each rail item swaps the right pane to the corresponding form.
- [ ] All form submissions work as before.
- [ ] Light mode: settings page readable.

**Open questions:** None.

---

### Phase 10 — Media detail + Play hub touch-ups

**Goal:** Apply the typography + badge updates without structural rebuilds.

**Scope (in):**

- `(main)/database/[id]/page.tsx`: title in Instrument Serif at page-title scale, italic accent word
  optional, eyebrow line with metadata, badge restyles (media-type accent badges at 10–20% bg +
  saturated fg).
- `(main)/play/page.tsx`: game cards all neutral icon treatment (no per-game accent). Cherry-red
  "live now" indicator only when a multiplayer game has active players.
- Game name and Lucide icon do the differentiation work.

**Scope (out):**

- Media detail data, watch session UI, in-game UI for the three games.
- Replacing game card layouts. Token-level adjustments only.

**Constraints:**

- Existing session flow (log session, rate, add to watchlist) unchanged.
- Game card click targets and route handling unchanged.

**Acceptance criteria:**

- [ ] Media detail title in Instrument Serif.
- [ ] Media-type badges use the new accent + 10–20% bg pattern.
- [ ] Play hub game cards all neutral.
- [ ] Cherry-red pulsing "live now" indicator appears only when applicable; otherwise hidden.
- [ ] Light mode: media detail + play hub readable.

**Open questions:** None.

---

### Phase 11 — Mobile pass

**Goal:** Make every editorial surface work below 900px.

**Scope (in):**

- Sidebar → drawer or bottom bar at narrow widths.
- Editorial mastheads scale down (clamped serif sizes, single-line layout).
- Conversational filter sentences fall back to chip rows below a threshold width.
- Asymmetric poster hero simplifies (e.g., single poster centered, supporting posters dropped).
- Magazine-cover profile header reflows.
- Stat strips wrap or transform into stacked cells.
- Dark only (per earlier decision — no extra light-mode tuning at mobile widths).

**Scope (out):**

- A mobile-first redesign of any surface. We're adapting, not rebuilding.
- Native app shell concerns (PWA install prompts, viewport meta tweaks unless broken).

**Constraints:**

- Touch targets ≥ 44px square.
- No hover-only affordances on touch widths.
- Navigation must remain reachable in ≤ 2 taps from any screen.

**Acceptance criteria:**

- [ ] Sidebar collapses to a drawer below 900px (the existing shadcn mobile Sheet drawer, via
      `MOBILE_BREAKPOINT = 900`). 900 is not arbitrary: the 256px rail plus the content column's
      ~623px min-width total ~879px, so between 768 and 899px the rail and content cannot both fit
      and the page scrolls horizontally. The drawer must therefore take over below ~900px, not 768.
- [ ] Every editorial masthead readable at 375px width.
- [ ] No horizontal scroll on any page below 900px.
- [ ] Touch targets ≥ 44px on every interactive element.
- [ ] Hover-only states have a touch equivalent.

**Open questions (resolved):**

- Drawer vs. bottom bar for the sidebar at narrow widths? **Resolved: drawer.** The shadcn sidebar
  already ships a `Sheet`-based mobile drawer keyed on `useIsMobile()`; a bottom bar would be a
  rebuild (out of scope). Keep the drawer; set the breakpoint to 900 (see above — 768 leaves a real
  horizontal-scroll band at 768-899px).
- Do we keep the editorial typography at mobile scale, or fall back to sans for headings?
  **Resolved: keep serif, clamp aggressively.** Verify mastheads at 375px and lower the clamp floor
  only where a title crowds the layout.

---

### Phase 12 — Scheduling & Queue (new product feature, NOT a visual phase)

**Status:** Parked. This is a real product feature, not part of the visual revamp. The design system
already specs its UI (`.cdb-queue-*`, `.cdb-db-timeline` / `.cdb-tl-*`, `.cdb-imp-proposed`, the
Propose button), so the visual layer is ready and waiting. Build the feature with its own
brainstorming / schema design pass; the design comes "for free" once the data exists.

This phase is intentionally sequenced **after** the visual rollout (Phases 0–11) finishes. The
rollout's stated goal is a pure visual revamp; adding new product features is an explicit non-goal
there. Surfaces that would eventually show queue data render the existing real-data fallback in the
meantime (see below), so no screen ships looking unfinished. Do not wire mock/placeholder proposal
data into the real app to populate the new design.

**The three features (all designed in the kit, none built in the app):**

- **Group queue with propose → vote → schedule.** A new dashboard section (`.cdb-queue-*` in the
  kit). The group proposes titles, votes, and one gets scheduled. This is the data source the
  sidebar Up Next card _would_ eventually read from.
- **Timeline view in Database.** A third view toggle (grid / list / timeline) with
  `.cdb-db-timeline` / `.cdb-tl-*` styling. Persist the last-used view in localStorage under
  `cdb:db-view` (the kit already uses this key).
- **"Propose to group" entry points.** A button in the Add Media / import-search dialog (already in
  the kit as `.cdb-imp-proposed` + Propose button) and a lighter affordance on personal-watchlist
  items (not yet in the kit).

**Follow-up enabled by this phase (not a new feature, a deferred enrichment):**

- **Database FeaturedBand picker + attendees.** Phase 6 built the FeaturedBand card
  (`(main)/database`) from per-media rating aggregates only, so its meta row shows type / year /
  runtime but omits the kit's "Picked by {picker}" line and attendee avatar stack. Those are
  per-session concepts, and a featured title can have several sessions, so surfacing them then would
  have meant a one-off join plus a "which session" rule on a decorative row. Once this phase makes
  picker + attendance first-class (the queue tracks who proposed and who showed), enrich the
  FeaturedBand card to match the kit: add the "Picked by" line and the attendee stack, keyed off the
  relevant session.

**Decisions already made (pin these — more will surface at implementation):**

- **Sidebar Up Next advance/replace behavior:** advance the slot when the current pick is logged as
  watched (the real "this is done" signal), then promote the top-voted queue item into the slot.
  Never auto-remove on the scheduled date alone. If the queue is empty, show a graceful empty state
  with a Propose CTA ("Nothing scheduled, propose something") rather than going blank or showing a
  stale pick. The sidebar stays a live anchor, not a countdown timer.
- **Propose source — do both, import dialog is primary:** lead with a "Propose to group" action in
  the import / search dialog, sitting next to the existing personal "Watchlist" button (proposing
  and discovering are the same impulse). Also add a lighter "Propose to group" affordance on
  personal-watchlist items as a follow-up, since people stockpile there. The group queue is its own
  store fed by both paths, so personal watchlists are untouched. Build the import-dialog button
  first; the watchlist → propose path is the follow-up.

**Until this ships (fallback in the visual rollout):**

- The sidebar Up Next card keeps its current real-data behavior: most recent in-progress session →
  top of the current user's watchlist → hidden. It shows "Up next in your watchlist", not "Proposed
  by". The "Proposed by" / scheduled-date copy from the kit is adopted only when this feature exists
  (see Phase 1 — sidebar stays as-is until then). This is a real fallback, not placeholder data.

**Open questions (defer to the feature's own brainstorming):**

- Schema: dedicated `proposals` / `queue` table vs. extending watch_sessions with a proposed/voting
  status. Real-time voting via Ably (already in the stack).
- Tie-breaking when votes are equal; who can schedule (any member vs. picker rotation).
- Does the dashboard queue section also need an empty state mirroring the sidebar CTA?

---

## 6. Order of operations

Phases 0 → 2 unblock everything; they can ship in any order against the existing screens with no
visual regression risk. Phases 3 → 10 follow the README's recommended sequence and each land as
small focused PRs. Phase 11 closes out mobile. Phase 12 (Scheduling & Queue) is a separate product
feature, sequenced after the visual rollout finishes — it is not a visual phase.

```
[0] Foundation tokens, fonts, favicon
    └─ [1] Sidebar polish
    └─ [2] Tagline derivation utility  (blocks [8])
[3] Landing
[4] Auth
[5] Dashboard
[6] Database          (introduces EditorialMasthead, ConversationalFilters)
[7] For You           (reuses [6] primitives)
[8] Users + Profile   (introduces IssueLine, MagazineCoverHeader; consumes [2])
[9] Settings          (reuses EditorialMasthead)
[10] Media + Play touch-ups
[11] Mobile pass
─────────────────────  (visual rollout complete)
[12] Scheduling & Queue  (NEW product feature; design already in kit; own brainstorming/schema pass)
```

---

## 7. Glossary

- **Editorial surface:** A page where we slow down and use magazine-spread typography (Instrument
  Serif at large sizes, italic accents, conversational filter sentences). Landing, database,
  for-you, users, profile, settings header, auth.
- **Utility surface:** A page where we stay quiet and dense (Geist sans, predictable rows, stat
  tiles). Dashboard, settings forms, activity feed, admin, watchlist, notifications.
- **Editorial primitive:** A reusable React component embodying one of the four editorial patterns
  (`<EditorialMasthead>`, `<IssueLine>`, `<ConversationalFilters>`, `<MagazineCoverHeader>`).
  Extracted on first use, not preemptively.
- **Foundation:** The CSS custom properties (`--cdb-*`, `--bg-*`, `--font-*`, etc.) and font loading
  set up in Phase 0. Powers everything downstream.
