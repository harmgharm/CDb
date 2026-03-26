# Cast/Actor Affinity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store top 8 cast members per movie/TV entry and use actor affinity to improve
recommendations, predictions, stats, and the media detail page.

**Architecture:** New `top_cast` JSONB column on `media` table. TMDB credits merged into existing
detail calls via `append_to_response`. Cast data flows through metadata extraction → DB → prediction
signals, content-based recommendations, stats queries, and media detail UI. Anime entries get `null`
cast.

**Tech Stack:** Kysely migrations, TMDB API v3, Next.js App Router, Tailwind CSS, shadcn/ui Tooltip

---

### Task 1: TMDB Types — Add Cast Member and Update Credits Response

**Files:**

- Modify: `src/types/tmdb.ts:102-114`

- [ ] **Step 1: Add TmdbCastMember interface and update TmdbCreditsResponse**

In `src/types/tmdb.ts`, add after the `TmdbCrewMember` interface (line 108) and before
`TmdbCreditsResponse`:

```ts
/** Cast member from /movie/{id}/credits or /tv/{id}/credits */
export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  order: number;
  profile_path: string | null;
  known_for_department: string;
}
```

Then update `TmdbCreditsResponse` (currently lines 111-114) to include cast:

```ts
/** Response from /movie/{id}/credits or /tv/{id}/credits */
export interface TmdbCreditsResponse {
  id: number;
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
}
```

- [ ] **Step 2: Add credits field to TmdbMovieDetail and TmdbTvDetail**

In `TmdbMovieDetail` (line 44-64), add after `release_dates?`:

```ts
  credits?: TmdbCreditsResponse;
```

In `TmdbTvDetail` (line 73-95), add after `content_ratings?`:

```ts
  credits?: TmdbCreditsResponse;
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm typecheck` Expected: PASS (new types are additive, nothing references them yet)

- [ ] **Step 4: Commit**

```bash
git add src/types/tmdb.ts
git commit -m "feat: add TmdbCastMember type and credits to detail types"
```

---

### Task 2: DB Types — Add CastMember Interface and top_cast Column Type

**Files:**

- Modify: `src/lib/db/types.ts:88-139`

- [ ] **Step 1: Add CastMember interface**

In `src/lib/db/types.ts`, add after the `JsonColumn` type helper (line 88) and before the TABLES
section comment (line 90):

```ts
/** Cast member stored in media.top_cast JSONB */
export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}
```

- [ ] **Step 2: Add top_cast to MediaTable**

In `MediaTable` (line 110-139), add after the `studios` field (line 138):

```ts
top_cast: JsonColumn<CastMember[]> | null;
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm typecheck` Expected: FAIL — files that `selectAll()` from media will now expect
`top_cast` in the DB, but the column doesn't exist yet. That's expected; the migration in Task 3
will fix the runtime, and we'll handle type errors as we go.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db/types.ts
git commit -m "feat: add CastMember interface and top_cast to MediaTable type"
```

---

### Task 3: Database Migration — Add top_cast Column

**Files:**

- Create: `src/lib/db/migrations/0027-media-top-cast.ts`

- [ ] **Step 1: Create migration file**

```ts
/**
 * Migration 0027: Add top_cast to media
 *
 * Stores top 8 cast members per movie/TV as JSONB array of
 * { id, name, character, profilePath } objects.
 */

import type { Kysely } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await db.schema.alterTable("media").addColumn("top_cast", "jsonb").execute();
}

export async function down(db: Kysely<never>): Promise<void> {
  await db.schema.alterTable("media").dropColumn("top_cast").execute();
}
```

- [ ] **Step 2: Run migration**

Run: `pnpm db:migrate` Expected: Migration 0027 applied successfully

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/migrations/0027-media-top-cast.ts
git commit -m "feat: add top_cast JSONB column to media table"
```

---

### Task 4: TMDB Client — Merge Credits into Detail Calls

**Files:**

- Modify: `src/lib/api/tmdb.ts:70-121`

- [ ] **Step 1: Update getMovieDetails to include credits**

Change line 73 from:

```ts
    append_to_response: "videos,release_dates",
```

to:

```ts
    append_to_response: "videos,release_dates,credits",
```

- [ ] **Step 2: Update getTvDetails to include credits**

Change line 80 from:

```ts
    append_to_response: "videos,content_ratings",
```

to:

```ts
    append_to_response: "videos,content_ratings,credits",
```

- [ ] **Step 3: Remove getMovieCredits function**

Delete lines 119-121:

```ts
export async function getMovieCredits(tmdbId: number): Promise<TmdbCreditsResponse> {
  return tmdbFetch(`/movie/${tmdbId.toString()}/credits`, { language: "en-US" });
}
```

Also remove `TmdbCreditsResponse` from the import list at the top of the file (line 11) if it's no
longer used directly (it's now only referenced via `TmdbMovieDetail.credits` and
`TmdbTvDetail.credits`).

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm typecheck` Expected: FAIL — `getMovieCredits` is imported in `src/lib/api/metadata.ts`
and `src/app/api/media/preview/route.ts` and `src/lib/predictions/resolve-media.ts`. We'll fix those
in the next tasks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/tmdb.ts
git commit -m "feat: merge credits into TMDB detail calls, remove getMovieCredits"
```

---

### Task 5: Metadata Extraction — Add Cast to Import and Refresh

**Files:**

- Modify: `src/lib/api/metadata.ts:7-191`

- [ ] **Step 1: Update imports and add CastMember import**

Replace the imports at lines 7-17:

```ts
import type { CastMember } from "@/lib/db/types";
import {
  findTrailerKey,
  findUsCertification,
  findUsContentRating,
  getMovieDetails,
  getTvDetails,
  getTvExternalIds,
  tmdbImageUrl,
} from "@/lib/api/tmdb";
```

Note: `getMovieCredits` is removed from imports since credits are now inline.

- [ ] **Step 2: Add topCast to MediaMetadata interface**

Add after `studios: string[] | null;` (line 43):

```ts
  topCast: CastMember[] | null;
```

- [ ] **Step 3: Add extractTopCast helper function**

Add after the `extractYoutubeKey` function (line 60):

```ts
function extractTopCast(
  cast:
    | { id: number; name: string; character: string; order: number; profile_path: string | null }[]
    | undefined,
): CastMember[] | null {
  if (cast === undefined || cast.length === 0) return null;
  return cast
    .toSorted((a, b) => a.order - b.order)
    .slice(0, 8)
    .map((member) => ({
      id: member.id,
      name: member.name,
      character: member.character,
      profilePath: member.profile_path,
    }));
}
```

- [ ] **Step 4: Update fetchMovieMetadata to use inline credits**

Replace `fetchMovieMetadata` (lines 62-96). The key changes:

- Remove `getMovieCredits` from `Promise.all` — just call `getMovieDetails(tmdbId)` (credits come
  inline)
- Extract directors from `movie.credits?.crew` instead of separate `credits`
- Add `topCast` extraction

```ts
export async function fetchMovieMetadata(tmdbId: number): Promise<MediaMetadata> {
  const movie = await getMovieDetails(tmdbId);

  const crew = movie.credits?.crew ?? [];
  const directors = crew.filter((member) => member.job === "Director").map((member) => member.name);

  return {
    title: movie.title,
    posterUrl: tmdbImageUrl(movie.poster_path),
    backdropUrl: tmdbImageUrl(movie.backdrop_path, "w780"),
    synopsis: movie.overview.length > 0 ? movie.overview : null,
    genres: movie.genres.map((g) => g.name),
    releaseYear: parseYear(movie.release_date),
    runtimeMinutes: movie.runtime,
    episodeCount: null,
    directors: directors.length > 0 ? directors : null,
    imdbId: movie.imdb_id,
    tmdbRating: movie.vote_average > 0 ? movie.vote_average : null,
    malScore: null,
    status: movie.status,
    originalTitle: movie.original_title === movie.title ? null : movie.original_title,
    tagline: movie.tagline.length > 0 ? movie.tagline : null,
    voteCount: movie.vote_count > 0 ? movie.vote_count : null,
    seasonCount: null,
    trailerKey: findTrailerKey(movie.videos?.results ?? []),
    originCountry: null,
    certification: findUsCertification(movie.release_dates ?? { results: [] }),
    networks: null,
    budget: movie.budget > 0 ? movie.budget : null,
    revenue: movie.revenue > 0 ? movie.revenue : null,
    studios:
      movie.production_companies.length > 0 ? movie.production_companies.map((c) => c.name) : null,
    topCast: extractTopCast(movie.credits?.cast),
  };
}
```

- [ ] **Step 5: Update fetchTvMetadata to extract cast**

In `fetchTvMetadata`, add `topCast` to the return object after `studios`:

```ts
    topCast: extractTopCast(show.credits?.cast),
```

- [ ] **Step 6: Update fetchAnimeMetadata**

In `fetchAnimeMetadata`, add `topCast: null` to the return object after `studios`.

- [ ] **Step 7: Update metadataToDbFields**

In `metadataToDbFields` (lines 164-191), add after the `studios` line:

```ts
    top_cast: metadata.topCast === null ? null : JSON.stringify(metadata.topCast),
```

- [ ] **Step 8: Verify typecheck passes**

Run: `pnpm typecheck` Expected: May still fail on other files importing `getMovieCredits`. Continue
to next tasks.

- [ ] **Step 9: Commit**

```bash
git add src/lib/api/metadata.ts
git commit -m "feat: extract top 8 cast members during media import"
```

---

### Task 6: Fix Preview Route — Use Inline Credits

**Files:**

- Modify: `src/app/api/media/preview/route.ts:10-42`

- [ ] **Step 1: Update imports**

Replace line 10:

```ts
import { findTrailerKey, getMovieCredits, getMovieDetails, getTvDetails } from "@/lib/api/tmdb";
```

with:

```ts
import { findTrailerKey, getMovieDetails, getTvDetails } from "@/lib/api/tmdb";
```

- [ ] **Step 2: Update fetchMoviePreview to use inline credits**

Replace `fetchMoviePreview` (lines 29-43):

```ts
async function fetchMoviePreview(tmdbId: number): Promise<MediaPreviewDetail> {
  const details = await getMovieDetails(tmdbId);
  const crew = details.credits?.crew ?? [];

  return {
    runtime: details.runtime,
    episodeCount: null,
    seasonCount: null,
    director: extractDirector({ crew }),
    creator: null,
    studios: details.production_companies.map((c) => c.name),
    status: details.status,
    tagline: details.tagline.length > 0 ? details.tagline : null,
    trailerUrl: youtubeUrl(details.videos ? findTrailerKey(details.videos.results) : null),
  };
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm typecheck` Expected: Preview route should compile. Other files may still have issues.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/media/preview/route.ts
git commit -m "refactor: use inline credits in preview route"
```

---

### Task 7: Fix Resolve Media — Use Inline Credits

**Files:**

- Modify: `src/lib/predictions/resolve-media.ts:8-181`

- [ ] **Step 1: Update imports**

Replace lines 8-15:

```ts
import { getAnimeDetails } from "@/lib/api/jikan";
import { findTrailerKey, getMovieDetails, getTvDetails, tmdbImageUrl } from "@/lib/api/tmdb";
import { db } from "@/lib/db";
import type { CastMember } from "@/lib/db/types";
import type { PredictionRequestInput } from "@/lib/validations/predictions";
```

- [ ] **Step 2: Add top_cast to findInDatabase select and return**

In `findInDatabase`, add `"top_cast"` to the select array (after `"trailer_key"` on line 70):

```ts
      "top_cast",
```

And in the return object (after line 95 `directors: row.directors ?? [],`), add:

```ts
      cast: (row.top_cast as CastMember[] | null)?.map((c) => c.name) ?? [],
```

- [ ] **Step 3: Update resolveFromTmdb movie path**

In the movie branch (lines 108-134), remove the separate credits call. Replace:

```ts
const [details, credits] = await Promise.all([getMovieDetails(tmdbId), getMovieCredits(tmdbId)]);

const directors = credits.crew.filter((c) => c.job === "Director").map((c) => c.name);
```

with:

```ts
const details = await getMovieDetails(tmdbId);

const crew = details.credits?.crew ?? [];
const directors = crew.filter((c) => c.job === "Director").map((c) => c.name);
const cast =
  details.credits?.cast
    ?.toSorted((a, b) => a.order - b.order)
    .slice(0, 8)
    .map((c) => c.name) ?? [];
```

Add `cast,` to the return object after `directors,`.

- [ ] **Step 4: Update resolveFromTmdb TV path**

In the TV branch (lines 136-158), add cast extraction after `const creators`:

```ts
const cast =
  details.credits?.cast
    ?.toSorted((a, b) => a.order - b.order)
    .slice(0, 8)
    .map((c) => c.name) ?? [];
```

Add `cast,` to the return object after `directors: creators,`.

- [ ] **Step 5: Update resolveFromJikan**

In `resolveFromJikan` (lines 161-181), add `cast: [],` to the return object after `directors: [],`.

- [ ] **Step 6: Verify typecheck passes**

Run: `pnpm typecheck` Expected: Will fail because `ResolvedMedia` doesn't have `cast` yet. That's
Task 8.

- [ ] **Step 7: Commit**

```bash
git add src/lib/predictions/resolve-media.ts
git commit -m "feat: resolve cast data from DB and TMDB in predictions"
```

---

### Task 8: Prediction Types — Add cast to ResolvedMedia and UserAffinityData

**Files:**

- Modify: `src/lib/predictions/types.ts:5-46`

- [ ] **Step 1: Update ResolvedMedia**

Add after `directors: string[];` (line 17):

```ts
  cast: string[];
```

- [ ] **Step 2: Update UserAffinityData**

Add after `runtimeBucketScores: Map<string, AffinityEntry>;` (line 43):

```ts
castScores: Map<string, AffinityEntry>;
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm typecheck` Expected: Will fail — `loadUserAffinity` doesn't return `castScores` yet. Next
task.

- [ ] **Step 4: Commit**

```bash
git add src/lib/predictions/types.ts
git commit -m "feat: add cast fields to prediction types"
```

---

### Task 9: User Affinity — Add Cast Processing

**Files:**

- Modify: `src/lib/predictions/user-affinity.ts:8-122`

- [ ] **Step 1: Update imports**

Add `CastMember` import. Replace line 11:

```ts
import type { CastMember, MediaType } from "@/lib/db/types";
```

- [ ] **Step 2: Update RatingRow interface**

Add after `directors: string[] | null;` (line 21):

```ts
  top_cast: CastMember[] | null;
```

- [ ] **Step 3: Update processRow to accept and populate cast map**

Update the `maps` parameter type (lines 48-54):

```ts
  maps: {
    genre: Map<string, AffinityEntry>;
    director: Map<string, AffinityEntry>;
    cast: Map<string, AffinityEntry>;
    decade: Map<number, AffinityEntry>;
    format: Map<MediaType, AffinityEntry>;
    runtime: Map<string, AffinityEntry>;
  },
```

Add cast processing after the directors block (after line 64):

```ts
if (row.top_cast !== null) {
  for (const member of row.top_cast) {
    addToAffinityMap(maps.cast, member.name, score);
  }
}
```

- [ ] **Step 4: Update SQL query to include top_cast**

In `loadUserAffinity`, update the SQL (lines 82-94). Add `m.top_cast` to the SELECT:

```ts
const rows = await sql<RatingRow>`
    SELECT
      r.score,
      m.type as media_type,
      m.release_year,
      m.runtime_minutes,
      m.genres,
      m.directors,
      m.top_cast
    FROM ratings r
    JOIN watch_sessions ws ON ws.id = r.session_id
    JOIN media m ON m.id = ws.media_id
    WHERE r.user_id = ${userId}
  `.execute(db);
```

- [ ] **Step 5: Update maps initialization**

Add `cast` map after `director` (line 98):

```ts
    cast: new Map<string, AffinityEntry>(),
```

- [ ] **Step 6: Update return object**

Add `castScores` after `directorScores` (line 115):

```ts
    castScores: maps.cast,
```

- [ ] **Step 7: Verify typecheck passes**

Run: `pnpm typecheck` Expected: Getting closer. Signals file still needs the cast signal.

- [ ] **Step 8: Commit**

```bash
git add src/lib/predictions/user-affinity.ts
git commit -m "feat: compute cast affinity scores from user ratings"
```

---

### Task 10: Cast Signal — Add computeCastSignal

**Files:**

- Modify: `src/lib/predictions/signals.ts:188-226`

- [ ] **Step 1: Add computeCastSignal function**

Add after the director signal section (after line 226):

```ts
// ============================================
// 3b. Cast Signal (weight: 0.05)
// ============================================

/**
 * Predict based on user's cast preferences.
 * Uses the best matching actor's average.
 */
export function computeCastSignal(affinity: UserAffinityData, media: ResolvedMedia): SignalResult {
  if (media.cast.length === 0) {
    return { score: null, weight: 0, detail: "No cast data available" };
  }

  let bestMatch: { actor: string; avg: number; count: number } | null = null;

  for (const actor of media.cast) {
    const entry = affinity.castScores.get(actor);
    if (entry !== undefined && (bestMatch === null || entry.count > bestMatch.count)) {
      bestMatch = { actor, avg: entry.avg, count: entry.count };
    }
  }

  if (bestMatch === null) {
    const castNames = media.cast.slice(0, 2).join(", ");
    return {
      score: null,
      weight: 0,
      detail: `You haven't rated other work by ${castNames}`,
    };
  }

  const countLabel = bestMatch.count === 1 ? "title" : "titles";
  const detail = `You rate films with ${bestMatch.actor} ${String(Math.round(bestMatch.avg * 10) / 10)} avg (${String(bestMatch.count)} ${countLabel})`;

  return { score: Math.round(bestMatch.avg * 10) / 10, weight: 0.05, detail };
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `pnpm typecheck` Expected: Signal function compiles. `predict.ts` and `predict-batch.ts` still
need wiring.

- [ ] **Step 3: Commit**

```bash
git add src/lib/predictions/signals.ts
git commit -m "feat: add cast prediction signal"
```

---

### Task 11: Prediction Engine — Wire Cast Signal and Rebalance Weights

**Files:**

- Modify: `src/lib/predictions/predict.ts:12-123`
- Modify: `src/lib/predictions/predict-batch.ts:12-143`

- [ ] **Step 1: Update predict.ts imports**

Add `computeCastSignal` to the import (line 12-20):

```ts
import {
  computeCollaborativeSignal,
  computeCastSignal,
  computeDirectorSignal,
  computeEraSignal,
  computeExternalSignal,
  computeGenreSignal,
  computeGroupSignal,
  getGroupRatingData,
} from "./signals";
```

- [ ] **Step 2: Update predict.ts DEFAULT_WEIGHTS**

Replace lines 24-31:

```ts
const DEFAULT_WEIGHTS: Record<string, number> = {
  collaborative: 0.3,
  genre: 0.25,
  director: 0.1,
  cast: 0.05,
  external: 0.1,
  group: 0.1,
  era: 0.1,
};
```

- [ ] **Step 3: Add castSignal computation in predict.ts**

After `const eraSignal` (line 72), add:

```ts
const castSignal = computeCastSignal(affinity, media);
```

- [ ] **Step 4: Add cast to signalMap in predict.ts**

Add to `signalMap` (line 74-81), after `director: directorSignal,`:

```ts
    cast: castSignal,
```

- [ ] **Step 5: Add cast to signals array in predict.ts**

In the `signals` array (lines 116-123), add after the director entry:

```ts
    buildSignal("cast", signalMap.cast),
```

- [ ] **Step 6: Update predict-batch.ts imports**

Add `computeCastSignal` to the import from `./signals` (lines 12-19):

```ts
import {
  computeCollaborativeSignal,
  computeCastSignal,
  computeDirectorSignal,
  computeEraSignal,
  computeExternalSignal,
  computeGenreSignal,
  computeGroupSignal,
} from "./signals";
```

- [ ] **Step 7: Update predict-batch.ts DEFAULT_WEIGHTS**

Replace lines 23-30 to match `predict.ts`:

```ts
const DEFAULT_WEIGHTS: Record<string, number> = {
  collaborative: 0.3,
  genre: 0.25,
  director: 0.1,
  cast: 0.05,
  external: 0.1,
  group: 0.1,
  era: 0.1,
};
```

- [ ] **Step 8: Add castSignal in predictSingleWithAffinity**

After `const eraSignal` (line 133), add:

```ts
const castSignal = computeCastSignal(affinity, media);
```

And add `cast: castSignal,` to the `combineSignals` argument (after `director: directorSignal,`):

```ts
return combineSignals(
  {
    collaborative: collaborativeSignal,
    genre: genreSignal,
    director: directorSignal,
    cast: castSignal,
    external: externalSignal,
    group: groupSignal,
    era: eraSignal,
  },
  affinity.ratingCount,
  affinity.overallAvg,
);
```

- [ ] **Step 9: Verify typecheck passes**

Run: `pnpm typecheck` Expected: Prediction engine should compile fully now.

- [ ] **Step 10: Commit**

```bash
git add src/lib/predictions/predict.ts src/lib/predictions/predict-batch.ts
git commit -m "feat: wire cast signal into prediction engine with 0.05 weight"
```

---

### Task 12: Content-Based Recommendations — Cast Affinity Path

**Files:**

- Modify: `src/lib/recommendations/content.ts:36-103`

- [ ] **Step 1: Add CastScore interface**

After `DirectorScore` (line 44-48), add:

```ts
interface CastScore {
  actor: string;
  avgRating: number;
  count: number;
}
```

- [ ] **Step 2: Add computeCastScores function**

After `computeDirectorScores` (line 130-154), add:

```ts
function computeCastScores(
  ratedMedia: {
    top_cast: { name: string }[] | null;
    score: string;
  }[],
): CastScore[] {
  const castMap = new Map<string, { total: number; count: number }>();

  for (const item of ratedMedia) {
    if (item.top_cast === null) continue;
    const score = Number(item.score);
    for (const member of item.top_cast) {
      const existing = castMap.get(member.name) ?? { total: 0, count: 0 };
      existing.total += score;
      existing.count += 1;
      castMap.set(member.name, existing);
    }
  }

  return [...castMap.entries()].map(([actor, data]) => ({
    actor,
    avgRating: Math.round((data.total / data.count) * 10) / 10,
    count: data.count,
  }));
}
```

- [ ] **Step 3: Add fetchCastBasedResults function**

After `fetchDirectorBasedResults` (line 328-387), add:

```ts
async function fetchCastBasedResults(
  topCast: CastScore[],
  watched: WatchedIds,
  userId: string,
): Promise<RecommendationItem[]> {
  if (topCast.length === 0) return [];

  const results: RecommendationItem[] = [];

  const attendedMediaIds = await db
    .selectFrom("session_attendees")
    .innerJoin("watch_sessions", "watch_sessions.id", "session_attendees.session_id")
    .select("watch_sessions.media_id")
    .where("session_attendees.user_id", "=", userId)
    .execute();

  const watchedMediaIds = new Set(attendedMediaIds.map((r) => r.media_id));

  for (const castScore of topCast) {
    const media = await db
      .selectFrom("media")
      .selectAll()
      .where(
        sql<boolean>`EXISTS (SELECT 1 FROM jsonb_array_elements(media.top_cast) AS c WHERE c->>'name' = ${castScore.actor})`,
      )
      .execute();

    for (const item of media) {
      if (watchedMediaIds.has(item.id)) continue;
      if (isAlreadyWatched(watched, { mediaId: item.id })) continue;

      const castMatchScore = castScore.avgRating / 10;
      const voteScore = (item.tmdb_rating ?? item.mal_score ?? 0) / 10;
      const combinedScore = 0.5 * castMatchScore + 0.5 * voteScore;

      results.push({
        mediaId: item.id,
        tmdbId: item.tmdb_id,
        malId: item.mal_id,
        title: item.title,
        posterUrl: item.poster_url,
        mediaType: item.type,
        overview: item.synopsis,
        releaseYear: item.release_year,
        voteAverage: item.tmdb_rating ?? item.mal_score,
        genres: item.genres,
        score: Math.round(combinedScore * 1000) / 1000,
        recType: "content",
        reasons: [
          {
            tag: "Featured cast",
            detail: `Features ${castScore.actor} (${String(castScore.avgRating)} avg)`,
          },
        ],
      });
    }
  }

  return results;
}
```

- [ ] **Step 4: Update computeContentRecommendations to include cast**

In the DB query (lines 59-65), add `"media.top_cast"` to the select:

```ts
    .select(["media.id", "media.genres", "media.directors", "media.top_cast", "media.type", "ratings.score"])
```

After `const directorScores` (line 71), add:

```ts
const castScores = computeCastScores(ratedMedia);
```

After `topDirectors` (line 79-82), add:

```ts
const topCast = castScores
  .filter((c) => c.avgRating >= 7.5 && c.count >= 2)
  .toSorted((a, b) => b.avgRating - a.avgRating)
  .slice(0, 5);
```

After the director results block (line 98-99), add:

```ts
// 6. Cast-based DB scan (zero API calls)
const castResults = await fetchCastBasedResults(topCast, watched, userId);
results.push(...castResults);
```

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm typecheck` Expected: PASS for this file.

- [ ] **Step 6: Commit**

```bash
git add src/lib/recommendations/content.ts
git commit -m "feat: add cast-based content recommendations"
```

---

### Task 13: Recommendation Reason Tags — Add Featured Cast Style

**Files:**

- Modify: `src/components/recommendations/recommendation-reason-tags.tsx:7-19`

- [ ] **Step 1: Add Featured cast tag style**

In `TAG_STYLES`, add after `"Top director"` (line 9):

```ts
  "Featured cast": "bg-violet-500/10 text-violet-500 hover:bg-violet-500/20",
```

- [ ] **Step 2: Commit**

```bash
git add src/components/recommendations/recommendation-reason-tags.tsx
git commit -m "feat: add violet styling for Featured cast reason tag"
```

---

### Task 14: Media Detail Page — Cast Headshot Row

**Files:**

- Modify: `src/app/(main)/database/[id]/page.tsx:1-40,224-229`
- Modify: `src/types/media-responses.ts:8-39`

- [ ] **Step 1: Add top_cast to MediaListItem type**

In `src/types/media-responses.ts`, add after `studios: string[] | null;` (line 36):

```ts
top_cast: {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}
[] | null;
```

- [ ] **Step 2: Add UserIcon import to media detail page**

In `src/app/(main)/database/[id]/page.tsx`, add `UserIcon` to the lucide-react import (line 3-14):

```ts
import {
  ArrowLeftIcon,
  BookmarkIcon,
  ClockIcon,
  ExternalLinkIcon,
  LoaderIcon,
  PlayCircleIcon,
  RefreshCwIcon,
  StarIcon,
  Trash2Icon,
  TvIcon,
  UserIcon,
} from "lucide-react";
```

Also add the Tooltip imports:

```ts
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
```

- [ ] **Step 3: Add cast headshot row**

After the directors block (line 229), add the cast section:

```tsx
{
  media.top_cast !== null && media.top_cast.length > 0 && (
    <TooltipProvider>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {media.top_cast.map((member) => (
          <Tooltip key={member.id}>
            <TooltipTrigger asChild>
              <div className="flex shrink-0 flex-col items-center gap-1">
                {member.profilePath !== null ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w185${member.profilePath}`}
                    alt={member.name}
                    width={48}
                    height={48}
                    className="size-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="bg-muted flex size-12 items-center justify-center rounded-full">
                    <UserIcon className="text-muted-foreground size-5" />
                  </div>
                )}
                <span className="max-w-16 truncate text-center text-[11px]">{member.name}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{member.character}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
```

- [ ] **Step 4: Verify typecheck and lint pass**

Run: `pnpm typecheck && pnpm lint` Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/media-responses.ts src/app/(main)/database/[id]/page.tsx
git commit -m "feat: display cast headshots on media detail page"
```

---

### Task 15: Stats Types and Queries — Add CastStat

**Files:**

- Modify: `src/types/detailed-stats.ts:28-133`
- Modify: `src/lib/stats/queries.ts:190-233`
- Modify: `src/components/stats/category-stat-list.tsx:6-21`

- [ ] **Step 1: Add CastStat type**

In `src/types/detailed-stats.ts`, after `DirectorStat` (line 33), add:

```ts
/** Cast stat entry */
export interface CastStat {
  actor: string;
  count: number;
  avgScore: number | null;
}
```

- [ ] **Step 2: Add cast section to GroupDetailedStats**

After `directors` block (line 89-93), add:

```ts
  cast: {
    mostWatched: CastStat[];
    highestRated: CastStat[];
    lowestRated: CastStat[];
  };
```

- [ ] **Step 3: Add cast section to UserDetailedStatsResponse**

After `directors` block (line 129-133), add:

```ts
  cast: {
    mostWatched: CastStat[];
    highestRated: CastStat[];
    lowestRated: CastStat[];
  };
```

- [ ] **Step 4: Add fetchCastStats and formatCastStats to queries**

In `src/lib/stats/queries.ts`, after `formatDirectorStats` (line 233), add:

```ts
// ============================================
// Cast Stats
// ============================================

interface CastStatsRow {
  actor: string;
  watch_count: string;
  avg_score: string | null;
  rating_count: string;
}

export async function fetchCastStats(userId?: string) {
  const userJoin =
    userId === undefined
      ? sql``
      : sql`JOIN session_attendees sa ON sa.session_id = ws.id AND sa.user_id = ${userId}`;

  const userRatingFilter = userId === undefined ? sql`` : sql`AND r.user_id = ${userId}`;

  const rows = await sql<CastStatsRow>`
    SELECT
      c->>'name' AS actor,
      COUNT(DISTINCT ws.id) as watch_count,
      AVG(r.score) as avg_score,
      COUNT(r.id) as rating_count
    FROM watch_sessions ws
    JOIN media m ON m.id = ws.media_id
    ${userJoin}
    CROSS JOIN LATERAL jsonb_array_elements(m.top_cast) AS c
    LEFT JOIN ratings r ON r.session_id = ws.id ${userRatingFilter}
    WHERE m.top_cast IS NOT NULL
    GROUP BY c->>'name'
    ORDER BY watch_count DESC
  `.execute(db);

  return rows.rows;
}

export function formatCastStats(rows: readonly CastStatsRow[], minRatings = 2) {
  return rows.map((r) => ({
    actor: r.actor,
    count: Number(r.watch_count),
    avgScore:
      Number(r.rating_count) >= minRatings ? Math.round(Number(r.avg_score) * 10) / 10 : null,
  }));
}
```

- [ ] **Step 5: Update CategoryStatList to handle CastStat**

In `src/components/stats/category-stat-list.tsx`, update the import (line 6):

```ts
import type { CastStat, DirectorStat, GenreStat, YearStat } from "@/types/detailed-stats";
```

Update the `StatItem` union (line 8):

```ts
type StatItem = GenreStat | DirectorStat | CastStat | YearStat;
```

Update `getItemLabel` (lines 17-21):

```ts
function getItemLabel(item: StatItem): string {
  if ("genre" in item) return item.genre;
  if ("director" in item) return item.director;
  if ("actor" in item) return item.actor;
  return String(item.year);
}
```

- [ ] **Step 6: Verify typecheck passes**

Run: `pnpm typecheck` Expected: Stats routes will fail because they don't return `cast` yet. Next
task.

- [ ] **Step 7: Commit**

```bash
git add src/types/detailed-stats.ts src/lib/stats/queries.ts src/components/stats/category-stat-list.tsx
git commit -m "feat: add cast stats types, queries, and UI support"
```

---

### Task 16: Stats Routes — Wire Cast Stats

**Files:**

- Modify: `src/app/api/stats/detailed/route.ts:10-113`
- Modify: `src/app/api/users/[id]/stats/detailed/route.ts:13-115`

- [ ] **Step 1: Update group stats route imports**

In `src/app/api/stats/detailed/route.ts`, add `fetchCastStats` and `formatCastStats` to imports
(lines 10-25):

```ts
import {
  fetchAvgRating,
  fetchAvgStartTime,
  fetchCastStats,
  fetchDirectorStats,
  fetchDivisiveMedia,
  fetchGenreStats,
  fetchHoursWatched,
  fetchPickerLeaderboard,
  fetchRankedMedia,
  fetchStreakData,
  fetchYearStats,
  formatCastStats,
  formatDirectorStats,
  formatGenreStats,
  formatRankedMedia,
  formatYearStats,
} from "@/lib/stats/queries";
```

- [ ] **Step 2: Add fetchCastStats to group stats Promise.all**

Add `fetchCastStats()` to the `Promise.all` array (after `fetchDirectorStats()`), and add
`castStatsRaw` to the destructured result:

```ts
const [
  streakData,
  hoursWatched,
  avgStartTime,
  avgRating,
  highestRatedRaw,
  lowestRatedRaw,
  divisiveMedia,
  genreStatsRaw,
  directorStatsRaw,
  castStatsRaw,
  yearStatsRaw,
  pickerLeaderboard,
] = await Promise.all([
  fetchStreakData(),
  fetchHoursWatched(),
  fetchAvgStartTime(),
  fetchAvgRating(),
  fetchRankedMedia("desc", 5),
  fetchRankedMedia("asc", 5),
  fetchDivisiveMedia(3),
  fetchGenreStats(),
  fetchDirectorStats(),
  fetchCastStats(),
  fetchYearStats(),
  fetchPickerLeaderboard(5),
]);
```

- [ ] **Step 3: Add cast formatting after director formatting**

After the director formatting block (line 72), add:

```ts
// Format cast stats
const castStats = formatCastStats(castStatsRaw);
const castWithScore = castStats.filter((c) => c.avgScore !== null);
const castByScore = castWithScore.toSorted((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
```

- [ ] **Step 4: Add cast section to group stats result**

After the `directors` section in the result object (line 99-103), add:

```ts
    cast: {
      mostWatched: castStats.slice(0, 5),
      highestRated: castByScore.slice(0, 5),
      lowestRated: castByScore.toReversed().slice(0, 5),
    },
```

- [ ] **Step 5: Update user stats route imports**

In `src/app/api/users/[id]/stats/detailed/route.ts`, add `fetchCastStats` and `formatCastStats` to
imports:

```ts
import {
  fetchAttendanceRate,
  fetchAvgRating,
  fetchCastStats,
  fetchDirectorStats,
  fetchGenreStats,
  fetchHoursWatched,
  fetchPickerStats,
  fetchRankedMedia,
  fetchYearStats,
  formatCastStats,
  formatDirectorStats,
  formatGenreStats,
  formatRankedMedia,
  formatYearStats,
} from "@/lib/stats/queries";
```

- [ ] **Step 6: Add fetchCastStats to user stats Promise.all**

Add `fetchCastStats(id)` to the `Promise.all` (after `fetchDirectorStats(id)`), and add
`castStatsRaw` to destructured result:

```ts
const [
  hoursWatched,
  attendance,
  avgRating,
  highestRatedRaw,
  lowestRatedRaw,
  genreStatsRaw,
  directorStatsRaw,
  castStatsRaw,
  yearStatsRaw,
  pickerStats,
] = await Promise.all([
  fetchHoursWatched(id),
  fetchAttendanceRate(id),
  fetchAvgRating(id),
  fetchRankedMedia("desc", 5, id),
  fetchRankedMedia("asc", 5, id),
  fetchGenreStats(id),
  fetchDirectorStats(id),
  fetchCastStats(id),
  fetchYearStats(id),
  fetchPickerStats(id),
]);
```

- [ ] **Step 7: Add cast formatting after director formatting**

After director formatting (line 76), add:

```ts
// Format and slice cast stats
const castStats = formatCastStats(castStatsRaw, 1);
const castWithScore = castStats.filter((c) => c.avgScore !== null);
const castByScore = castWithScore.toSorted((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
```

- [ ] **Step 8: Add cast section to user stats result**

After `directors` section in the result (line 101-104), add:

```ts
    cast: {
      mostWatched: castStats.slice(0, 5),
      highestRated: castByScore.slice(0, 5),
      lowestRated: castByScore.toReversed().slice(0, 5),
    },
```

- [ ] **Step 9: Verify full typecheck and lint pass**

Run: `pnpm typecheck && pnpm lint` Expected: PASS — all types should now be satisfied.

- [ ] **Step 10: Commit**

```bash
git add src/app/api/stats/detailed/route.ts src/app/api/users/[id]/stats/detailed/route.ts
git commit -m "feat: include cast stats in group and user detailed stats"
```

---

### Task 17: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck` Expected: PASS with no errors

- [ ] **Step 2: Run linter**

Run: `pnpm lint` Expected: PASS (fix any issues if found)

- [ ] **Step 3: Run tests**

Run: `pnpm test` Expected: Existing tests pass (no test changes needed for this feature — tests
don't mock DB columns)

- [ ] **Step 4: Build**

Run: `pnpm build` Expected: Successful build

- [ ] **Step 5: Manual verification checklist**

After deploying, verify:

- Hit Admin > Refresh All Metadata to backfill cast for existing movie/TV entries
- Check a movie detail page — cast headshot row should appear
- Check a TV show detail page — cast headshot row should appear
- Check an anime detail page — no cast section (expected)
- Check `/recommendations` — "Featured cast" violet tags should appear on content recs (if enough
  ratings)
- Check group detailed stats — cast section with most watched / highest rated / lowest rated
- Check user detailed stats — same cast section
- Run a prediction — cast signal should appear in the breakdown
