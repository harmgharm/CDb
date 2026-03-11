/**
 * Collaborative Filtering
 *
 * Finds users with similar rating patterns (Pearson correlation)
 * and surfaces media they rated highly that the current user hasn't watched.
 */

import { sql } from "kysely";

import { discoverMovies, discoverTv, tmdbImageUrl } from "@/lib/api/tmdb";
import {
  getMovieGenreId,
  getTvGenreId,
  mapMovieGenreIds,
  mapTvGenreIds,
} from "@/lib/api/tmdb-genres";
import { db } from "@/lib/db";
import type { TmdbMovieSearchResult, TmdbTvSearchResult } from "@/types/tmdb";

import { getUserDismissedIds } from "./dismissed";
import { pearsonCorrelation } from "./math";
import { addScoreJitter, randomPage, randomSample } from "./random";
import type { RecommendationItem, WatchedIds } from "./types";
import { sliceWithTypeDepth } from "./types";
import { getUserWatchedIds, isAlreadyWatched, mergeWatchedIds } from "./watched";

// Re-export for public API
export { pearsonCorrelation } from "./math";

interface UserRating {
  mediaId: string;
  score: number;
}

interface UserSimilarity {
  userId: string;
  username: string;
  displayName: string | null;
  correlation: number;
  sharedCount: number;
}

interface GenrePreference {
  genre: string;
  avg: number;
}

/**
 * Compute collaborative filtering recommendations for a user.
 * Requires the user to have at least 5 ratings.
 */
export async function computeCollaborativeRecommendations(
  userId: string,
  limit = 60,
): Promise<RecommendationItem[]> {
  // 1. Get current user's ratings (via sessions → media)
  const userRatings = await getUserRatings(userId);
  if (userRatings.length < 5) return [];

  const userRatingMap = new Map(userRatings.map((r) => [r.mediaId, r.score]));

  // 2. Get all other users who have at least 3 ratings
  const otherUsers = await db
    .selectFrom("ratings")
    .innerJoin("users", "users.id", "ratings.user_id")
    .select([
      "users.id",
      "users.username",
      "users.display_name",
      db.fn.countAll().as("rating_count"),
    ])
    .where("ratings.user_id", "!=", userId)
    .groupBy(["users.id", "users.username", "users.display_name"])
    .having(db.fn.countAll(), ">=", 3)
    .execute();

  // 3. Compute similarity with each other user
  const similarities: UserSimilarity[] = [];

  for (const other of otherUsers) {
    const similarity = await computeUserSimilarity(other, userRatingMap);
    if (similarity !== null) {
      similarities.push(similarity);
    }
  }

  if (similarities.length === 0) return [];

  // 4. Randomly select 3 from top 5 most similar users for variety
  const topCandidates = similarities.toSorted((a, b) => b.correlation - a.correlation).slice(0, 5);
  const topSimilar = randomSample(topCandidates, 3);

  // 5. Get watched IDs for exclusion
  const watched = mergeWatchedIds(
    await getUserWatchedIds(userId),
    await getUserDismissedIds(userId),
  );
  const results: RecommendationItem[] = [];

  // 6. For each similar user, find media they rated >= 7.5 that current user hasn't watched
  for (const similar of topSimilar) {
    const highlyRated = await db
      .selectFrom("ratings")
      .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
      .innerJoin("media", "media.id", "watch_sessions.media_id")
      .select([
        "media.id",
        "media.title",
        "media.type",
        "media.tmdb_id",
        "media.mal_id",
        "media.poster_url",
        "media.synopsis",
        "media.release_year",
        "media.tmdb_rating",
        "media.mal_score",
        "media.genres",
        "ratings.score",
      ])
      .where("ratings.user_id", "=", similar.userId)
      .where(sql`ratings.score`, ">=", sql`7.5`)
      .orderBy("ratings.score", "desc")
      .execute();

    const correlationPct = Math.round(similar.correlation * 100);
    const displayName = similar.displayName ?? similar.username;

    for (const item of highlyRated) {
      if (
        isAlreadyWatched(watched, { mediaId: item.id, tmdbId: item.tmdb_id, malId: item.mal_id })
      ) {
        continue;
      }

      const theirScore = Number(item.score);
      const combinedScore = similar.correlation * (theirScore / 10);

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
        recType: "collaborative",
        reasons: [
          {
            tag: "Similar taste",
            detail: `${String(correlationPct)}% match with @${displayName} who rated it ${String(theirScore)}`,
          },
        ],
      });
    }
  }

  // Fallback: when similar users exist but shared watchlists leave few unique recs
  if (results.length < 3 && topSimilar.length > 0) {
    const fallbackItems = await fetchCollaborativeFallback(topSimilar, watched);
    results.push(...fallbackItems);
  }

  // Deduplicate, jitter, sample, then type-depth slice
  const deduplicated = deduplicateCollaborative(results);
  const jittered = addScoreJitter(deduplicated);
  const pool = randomSample(jittered, Math.max(limit, 100));
  return sliceWithTypeDepth(pool, limit);
}

async function computeUserSimilarity(
  other: { id: string; username: string; display_name: string | null },
  userRatingMap: Map<string, number>,
): Promise<UserSimilarity | null> {
  const otherRatings = await getUserRatings(other.id);
  const otherRatingMap = new Map(otherRatings.map((r) => [r.mediaId, r.score]));

  // Find shared media
  const sharedMediaIds: string[] = [];
  for (const mediaId of userRatingMap.keys()) {
    if (otherRatingMap.has(mediaId)) {
      sharedMediaIds.push(mediaId);
    }
  }

  if (sharedMediaIds.length < 3) return null;

  // Both maps are guaranteed to contain these IDs (sharedMediaIds was built from their intersection)
  const userScores = sharedMediaIds.map((id) => getScore(userRatingMap, id));
  const otherScores = sharedMediaIds.map((id) => getScore(otherRatingMap, id));

  const correlation = pearsonCorrelation(userScores, otherScores);

  if (correlation <= 0.3) return null;

  return {
    userId: other.id,
    username: other.username,
    displayName: other.display_name,
    correlation,
    sharedCount: sharedMediaIds.length,
  };
}

async function getUserRatings(userId: string): Promise<UserRating[]> {
  const rows = await db
    .selectFrom("ratings")
    .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
    .select(["watch_sessions.media_id", "ratings.score"])
    .where("ratings.user_id", "=", userId)
    .execute();

  return rows.map((r) => ({ mediaId: r.media_id, score: Number(r.score) }));
}

function deduplicateCollaborative(items: RecommendationItem[]): RecommendationItem[] {
  const best = new Map<string, RecommendationItem>();

  for (const item of items) {
    const key = item.mediaId ?? `tmdb-${String(item.tmdbId)}`;
    const existing = best.get(key);
    if (existing === undefined || item.score > existing.score) {
      // If we have multiple similar users recommending the same thing, keep highest score
      // but combine reasons
      if (existing !== undefined) {
        item.reasons = [...existing.reasons, ...item.reasons];
      }
      best.set(key, item);
    }
  }

  return [...best.values()].toSorted((a, b) => b.score - a.score);
}

/**
 * Fallback for tight groups: when similar users exist but all watch the same media,
 * discover new titles based on the similar users' shared genre preferences.
 */
async function fetchCollaborativeFallback(
  similarUsers: UserSimilarity[],
  watched: WatchedIds,
): Promise<RecommendationItem[]> {
  const topGenres = await collectSimilarUserGenres(similarUsers);
  const bestUser = similarUsers[0];

  if (bestUser === undefined) return [];

  const displayName = bestUser.displayName ?? bestUser.username;
  const correlationPct = Math.round(bestUser.correlation * 100);

  return discoverForSharedGenres(topGenres, watched, { displayName, correlationPct });
}

async function collectSimilarUserGenres(
  similarUsers: UserSimilarity[],
): Promise<GenrePreference[]> {
  const genreCounts = new Map<string, { total: number; count: number }>();

  for (const similar of similarUsers) {
    const ratedMedia = await db
      .selectFrom("ratings")
      .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
      .innerJoin("media", "media.id", "watch_sessions.media_id")
      .select(["media.genres", "ratings.score"])
      .where("ratings.user_id", "=", similar.userId)
      .where(sql`ratings.score`, ">=", sql`7.5`)
      .execute();

    for (const row of ratedMedia) {
      const score = Number(row.score);
      for (const genre of row.genres) {
        const existing = genreCounts.get(genre) ?? { total: 0, count: 0 };
        existing.total += score;
        existing.count += 1;
        genreCounts.set(genre, existing);
      }
    }
  }

  return [...genreCounts.entries()]
    .map(([genre, data]) => ({ genre, avg: data.total / data.count }))
    .toSorted((a, b) => b.avg - a.avg)
    .slice(0, 2);
}

async function discoverForSharedGenres(
  topGenres: GenrePreference[],
  watched: WatchedIds,
  context: { displayName: string; correlationPct: number },
): Promise<RecommendationItem[]> {
  const results: RecommendationItem[] = [];

  for (const { genre } of topGenres) {
    const movieGenreId = getMovieGenreId(genre);
    const tvGenreId = getTvGenreId(genre);
    const targetGenreId = movieGenreId ?? tvGenreId;
    if (targetGenreId === null) continue;

    try {
      const isMovie = movieGenreId !== null;
      const page = randomPage(5);
      const response = isMovie
        ? await discoverMovies({
            with_genres: targetGenreId.toString(),
            sort_by: "vote_average.desc",
            "vote_count.gte": "100",
            page,
          })
        : await discoverTv({
            with_genres: targetGenreId.toString(),
            sort_by: "vote_average.desc",
            "vote_count.gte": "100",
            page,
          });

      for (const item of response.results.slice(0, 5)) {
        if (isAlreadyWatched(watched, { tmdbId: item.id })) continue;

        const parsed = isMovie
          ? parseDiscoverResult(item as TmdbMovieSearchResult, "movie")
          : parseDiscoverResult(item as TmdbTvSearchResult, "tv");

        const voteScore = (parsed.voteAverage ?? 0) / 10;

        results.push({
          ...parsed,
          score: Math.round(voteScore * 0.8 * 1000) / 1000,
          recType: "collaborative",
          reasons: [
            {
              tag: "Shared taste",
              detail: `${String(context.correlationPct)}% match with @${context.displayName} — you both love ${genre}`,
            },
          ],
        });
      }
    } catch {
      // TMDB error — skip genre
    }
  }

  return results;
}

function parseDiscoverResult(
  item: TmdbMovieSearchResult | TmdbTvSearchResult,
  mediaType: "movie" | "tv",
): Omit<RecommendationItem, "score" | "recType" | "reasons"> {
  const title = "title" in item ? item.title : item.name;
  const dateField = "release_date" in item ? item.release_date : item.first_air_date;
  const genreMapper = mediaType === "movie" ? mapMovieGenreIds : mapTvGenreIds;

  return {
    mediaId: null,
    tmdbId: item.id,
    malId: null,
    title,
    posterUrl: tmdbImageUrl(item.poster_path),
    mediaType,
    overview: item.overview,
    releaseYear: dateField.length > 0 ? Number(dateField.slice(0, 4)) : null,
    voteAverage: item.vote_average,
    genres: genreMapper(item.genre_ids),
  };
}

/** Get a score from a rating map, throwing if the key is missing (indicates a bug). */
function getScore(map: Map<string, number>, key: string): number {
  const score = map.get(key);
  if (score === undefined) {
    throw new Error(`Expected rating for media ${key} but found none`);
  }
  return score;
}
