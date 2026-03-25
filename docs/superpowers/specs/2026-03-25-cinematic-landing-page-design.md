# Cinematic Landing Page Redesign

## Overview

Redesign the logged-out landing page (`src/app/page.tsx`) from a basic stats dashboard into a dark,
cinematic showcase that makes CDB feel like a polished product worth joining.

**Direction:** Showcase / portfolio feel **Vibe:** Dark & cinematic (Netflix/Letterboxd inspired)
**Layout:** Cinematic hero with poster backdrop + feature grid + poster row + scrolling ticker
**Animation:** Cinematic entrances using Motion (Framer Motion) — no GSAP

## Data Source

All data comes from the existing `GET /api/stats/public` endpoint (no auth required). The response
already includes:

- `mediaWatched` — counts by type (movie, tv, anime)
- `totalSessions`, `totalRatings`, `memberCount`, `hoursWatched`, `avgRating`
- `mostWatchedGenre` — top genre by session count (intentionally unused in redesign)
- `topMedia` — top 5 by avg score (id, title, type, posterUrl, avgScore, ratingCount)
- `recentMedia` — last 6 watched (title, type, posterUrl, dateWatched)

No API changes are needed.

## Sections

### 1. Hero (full viewport height)

**Backdrop:** Blurred, faded poster collage from the group's top-rated media. Poster URLs sourced
from `topMedia[].posterUrl` in the public stats response. Heavy gradient overlay (transparent at
top, black at bottom) so text is always readable.

**Content (centered, overlaying backdrop):**

- "CDb" — large, bold title
- "Track movies, anime, and TV shows with friends" — tagline
- Inline stats row: "**X** movies . **Y** sessions . **Z** hours watched"
- Two CTAs: Log In (primary/filled) + Sign Up (outline)

**Animations (Motion):**

- Backdrop posters fade in one by one with slight scale (1.05 to 1.0)
- Title and tagline fade up with slight y-translate
- Stats count up from zero (animate number values)
- CTAs fade in last

### 2. Feature Grid (2x2)

Four cards highlighting CDB's features. Each has a colored accent, icon, title, and one-line
description.

| Card | Accent Color | Title                 | Description                                          |
| ---- | ------------ | --------------------- | ---------------------------------------------------- |
| 1    | Purple       | Track & Rate          | Log watch sessions and score them together           |
| 2    | Blue         | Smart Recommendations | AI-powered suggestions based on your group's taste   |
| 3    | Amber        | Stats & Insights      | Personal and group analytics on everything you watch |
| 4    | Green        | Games                 | Poster reveal, year guesser, and more                |

**Styling:** Subtle gradient backgrounds matching each accent color with faint colored borders. Dark
glass-like feel.

**Animations:** Cards slide/fade in on scroll (staggered, using `whileInView`).

### 3. Top Rated by the Group

Horizontal row of 5 poster cards from `topMedia`.

Each card shows:

- Full poster image (2:3 aspect ratio) via next/image
- Title below the poster (truncated if long)
- Star rating + count (e.g. "9.2 (4)")
- Media type badge overlaid on poster corner

**Styling:** Slight hover scale effect (1.0 to 1.03).

**Animations:** Poster cards stagger in from below on scroll (`whileInView`).

### 4. Recently Watched Ticker

Auto-scrolling horizontal marquee showing the 6 most recently watched media.

Each item shows:

- Small poster thumbnail + title + media type badge + watch date

**Implementation:**

- CSS `@keyframes` animation (translateX) with duplicated content for seamless loop
- No JS animation needed
- Pauses on hover (`animation-play-state: paused`)
- Slow, ambient scrolling speed
- Duplicate `recentMedia` items 2-3x in the DOM to ensure the ticker fills wide viewports before
  looping

**Styling:** Sits in a subtle border-top strip. Muted relative to the rest of the page — ambient
texture, not a focal section.

### 5. Footer

Minimal footer with:

- Log In + Sign Up buttons (centered)
- GitHub logo linking to `https://github.com/harmgharm/CDb`
- Dynamic copyright: `(c) {currentYear} CDb` using `new Date().getFullYear()`

No heading or subtext. Just the essentials.

**Animations:** Fade in on scroll.

## File Changes

### Modified

- `src/app/page.tsx` — Full rewrite of the landing page component. Remains a `"use client"`
  component. Same auth check + public stats fetch logic, new UI structure.

### No API Changes

The existing `/api/stats/public` endpoint provides all required data.

### No New Dependencies

Motion (Framer Motion) is already installed and handles all animations. Lucide icons already
available. next/image already configured for TMDB/MAL image domains.

## Edge Cases

- **Empty `topMedia`** (no media with 2+ ratings): Hero falls back to a solid dark gradient backdrop
  (no poster collage). Top Rated section is hidden entirely.
- **Empty `recentMedia`**: Ticker section is hidden entirely.
- **Null `posterUrl`**: Use the existing `MediaPoster` component which shows a placeholder icon for
  null URLs. In the hero backdrop, skip entries with null posters.
- **All stats zero** (fresh deployment): Show zeros in the stats row. Feature grid and footer still
  render normally — the page works as a product showcase even with no data.

## Loading States

- **Hero**: Dark gradient background with pulsing skeleton placeholders for title, tagline, and
  stats row. No poster backdrop while loading.
- **Feature Grid**: Not data-dependent — renders immediately (static content).
- **Top Rated**: Row of 5 skeleton rectangles (2:3 aspect ratio) with pulsing animation.
- **Ticker**: Hidden while loading. Appears once `recentMedia` is available.
- **Footer**: Not data-dependent — renders immediately.

## Technical Notes

- The page remains a client component (`"use client"`) for the auth check + stats fetch pattern
- Middleware already redirects authenticated users from `/` to `/home`. The client-side auth check
  in `page.tsx` is a fallback for users with an expired access token but valid refresh token
  (middleware only checks the access token).
- Poster images use next/image with existing remote patterns (image.tmdb.org, cdn.myanimelist.net)
- The ticker uses pure CSS animation, not Motion — simpler and more performant for continuous scroll
- Count-up animation for stats uses Motion's `useMotionValue` + `useTransform` + `animate`, imported
  from `motion/react` or `motion/react-client`
- Use `import * as motion from "motion/react-client"` per project convention for motion components
- `whileInView` with `viewport={{ once: true }}` for scroll-triggered animations (animate once, not
  on every scroll pass)
- Skeleton loading states per section described above
