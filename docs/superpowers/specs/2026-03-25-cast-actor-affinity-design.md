# Cast/Actor Affinity — Design Spec

## Overview

Store the top 8 cast members per movie/TV entry and use actor affinity data to improve
recommendations, predictions, stats, and the media detail page UI.

Anime entries get `top_cast: null` — voice actor affinity is a much weaker signal and requires extra
Jikan API calls with rate limit pressure. Can be revisited later.

## Data Model

### Migration 0027: Add `top_cast` column

New nullable JSONB column on the `media` table:

```sql
ALTER TABLE media ADD COLUMN top_cast jsonb;
```

### CastMember type

```ts
interface CastMember {
  id: number; // TMDB person ID (deduplication)
  name: string; // Actor name
  character: string; // Role/character name
  profilePath: string | null; // TMDB image path (not full URL, use tmdbImageUrl() to resolve)
}
```

Stored as `JsonColumn<CastMember[]> | null` on `MediaTable` in `src/lib/db/types.ts`.

Top 8 cast members by TMDB billing order. Nullable for anime and pre-backfill entries.

## TMDB API Layer

### Merge credits into detail calls

Eliminate the standalone `getMovieCredits` function. Instead, add `credits` to the
`append_to_response` parameter on existing detail calls:

- `getMovieDetails`: `"videos,release_dates"` → `"videos,release_dates,credits"`
- `getTvDetails`: `"videos,content_ratings"` → `"videos,content_ratings,credits"`

This means cast + crew data comes back in the same response — zero additional API calls.

### New types in `src/types/tmdb.ts`

```ts
interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  order: number; // billing order (0 = lead)
  profile_path: string | null;
  known_for_department: string;
}
```

Update `TmdbCreditsResponse` to include `cast: TmdbCastMember[]` alongside existing `crew`.

Add `credits?: TmdbCreditsResponse` to both `TmdbMovieDetail` and `TmdbTvDetail`.

### Removals

- Delete `getMovieCredits` from `src/lib/api/tmdb.ts`
- Update `src/app/api/media/preview/route.ts` to read from `details.credits` instead of a separate
  credits call

## Metadata Extraction

### `src/lib/api/metadata.ts`

Add `topCast: CastMember[] | null` to the `MediaMetadata` interface.

**`fetchMovieMetadata`:**

- Read `movie.credits.cast` (from the merged append_to_response)
- Sort by `order`, slice top 8
- Map to `CastMember`: `{ id, name, character, profilePath: member.profile_path }`
- Directors also now come from `movie.credits.crew` instead of separate call

**`fetchTvMetadata`:**

- Read `show.credits.cast`, sort by `order`, slice top 8, map to `CastMember`
- Directors remain from `created_by` (no change)

**`fetchAnimeMetadata`:**

- Return `topCast: null`

**`metadataToDbFields`:**

- Add: `top_cast: metadata.topCast === null ? null : JSON.stringify(metadata.topCast)`

### Backfill

Use the existing admin "Refresh All Metadata" feature (`/api/admin/media/refresh`). Once the
metadata extraction changes are deployed, hitting refresh backfills cast for all movie/TV entries.
No new backfill code needed.

## Prediction Engine

### Weight rebalance

| Signal              | Before | After    |
| ------------------- | ------ | -------- |
| Collaborative       | 0.30   | 0.30     |
| Genre               | 0.25   | 0.25     |
| Director            | 0.15   | **0.10** |
| Cast                | —      | **0.05** |
| External (TMDB/MAL) | 0.10   | 0.10     |
| Group ratings       | 0.10   | 0.10     |
| Era/format          | 0.10   | 0.10     |

Cast gets the smaller weight as the newer, less-proven signal. Director remains the stronger
"people" signal since users tend to follow directors more intentionally. As cast data matures and
proves predictive, the weight can be tuned up.

The weight redistribution system already handles unavailable signals (anime with no cast data) by
proportionally distributing the missing weight to available signals.

### Types (`src/lib/predictions/types.ts`)

- Add `cast: string[]` to `ResolvedMedia`
- Add `castScores: Map<string, AffinityEntry>` to `UserAffinityData`

### User affinity (`src/lib/predictions/user-affinity.ts`)

- Add `top_cast` to SQL select and `RatingRow`
- In `processRow`: iterate cast members, call `addToAffinityMap(maps.cast, member.name, score)`
- Return `castScores` in result

### Resolve media (`src/lib/predictions/resolve-media.ts`)

- `findInDatabase`: Select `top_cast`, map to `cast: row.top_cast?.map(c => c.name) ?? []`
- `resolveFromTmdb` (movie/TV): Extract top 8 cast names from credits response
- `resolveFromJikan`: `cast: []`

### New signal (`src/lib/predictions/signals.ts`)

`computeCastSignal(affinity, media)`:

- Find cast members present in `affinity.castScores`
- Use the one with highest count (most data points)
- Return their avg as predicted score
- Detail: `"You rate films with [actor] [X] avg ([N] titles)"`

### `src/lib/predictions/predict.ts`

- Add `cast: 0.05` to `DEFAULT_WEIGHTS`
- Change `director` from `0.15` to `0.10`
- Wire `computeCastSignal` into `signalMap`

## Content-Based Recommendations

### `src/lib/recommendations/content.ts`

New functions following the director pattern:

**`computeCastScores`:**

- Iterate rated media with `top_cast`
- Accumulate `{ total, count }` per actor name
- Filter: `avgRating >= 7.5` AND `count >= 2` (require 2+ titles to avoid single-film noise)
- Limit to top 5 actors by avg rating

**`fetchCastBasedResults`:**

- Query DB for unwatched media featuring the actor:
  `EXISTS (SELECT 1 FROM jsonb_array_elements(media.top_cast) AS c WHERE c->>'name' = $actorName)`
- Reason tag: `"Featured cast"` with detail `"Features [actor] ([X] avg)"`

### Reason tag styling (`src/components/recommendations/recommendation-reason-tags.tsx`)

Add to `TAG_STYLES`:

```ts
"Featured cast": "bg-violet-500/10 text-violet-500 hover:bg-violet-500/20"
```

Multiple actor matches collapse into one badge with multiple tooltip lines (existing dedup
behavior).

## Media Detail Page

### `src/app/(main)/database/[id]/page.tsx`

Horizontal scrollable cast section below the "Directed by" / "Created by" line:

- Overflow container with `overflow-x-auto` and hidden scrollbar
- Each cast member: circular `next/image` headshot (~48x48, `w185` TMDB size), actor name below in
  small text
- Character name shown in tooltip on hover
- Fallback for null `profilePath`: Lucide `UserIcon` or initials in a neutral circle
- Only rendered when `top_cast` is non-null and non-empty
- For 8 actors: fits on one row on desktop, scrolls on mobile

## Stats Integration

### New type in `src/types/detailed-stats.ts`

```ts
interface CastStat {
  actor: string;
  count: number;
  avgScore: number | null;
}
```

### New query in `src/lib/stats/queries.ts`

`fetchCastStats` — mirrors `fetchDirectorStats`:

```sql
SELECT c->>'name' AS actor, COUNT(*) AS count, AVG(r.score) AS avg_score
FROM media m
CROSS JOIN LATERAL jsonb_array_elements(m.top_cast) AS c
JOIN watch_sessions ws ON ws.media_id = m.id
JOIN ratings r ON r.session_id = ws.id
WHERE m.top_cast IS NOT NULL
GROUP BY c->>'name'
```

### Stats response types

Add `cast` section to both `GroupDetailedStats` and `UserDetailedStatsResponse`:

```ts
cast: {
  mostWatched: CastStat[];
  highestRated: CastStat[];
  lowestRated: CastStat[];
}
```

### Stats routes

Update both `/api/stats/detailed` and `/api/users/[id]/stats/detailed` to call `fetchCastStats` and
include cast stats in the response.

## Scope Boundaries

### In scope

- DB migration for `top_cast` column
- TMDB type updates + merge credits into detail calls
- Metadata extraction for movies and TV
- Prediction engine: new cast signal + weight rebalance
- Content-based recommendations: cast affinity path
- Media detail page: headshot row
- Stats: cast stats in group and user detailed stats
- Backfill via existing admin refresh

### Out of scope

- Anime voice actor support (deferred)
- Actor profile/detail pages (future feature)
- Actor-based search/filtering on database page (future feature)
- Accuracy tracking for predictions (separate v2 item)
- GIN index on `top_cast` (not needed at current scale, ~200 entries)
