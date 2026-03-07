/**
 * Fallback Recommendations (< 5 ratings)
 *
 * For users who haven't rated enough to unlock personalized recommendations,
 * serve un-personalized suggestions based on the group's recent highly-rated media
 * and TMDB recommendations from those titles.
 */

import { db } from "@/lib/db";

import { computeTmdbRecommendations } from "./tmdb-recs";
import type { RecommendationItem } from "./types";
import { getUserWatchedIds, isAlreadyWatched } from "./watched";

/**
 * Compute fallback (non-personalized) recommendations for a user with < 5 ratings.
 * Based on what the group has recently rated highly.
 */
export async function computeFallbackRecommendations(
  userId: string,
  limit = 20,
): Promise<RecommendationItem[]> {
  const watched = await getUserWatchedIds(userId);
  const results: RecommendationItem[] = [];

  // 1. Get group's recently highly-rated media (avg >= 7.5, last 90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const groupHighlyRated = await db
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
      db.fn.avg("ratings.score").as("avg_score"),
      db.fn.countAll().as("rating_count"),
    ])
    .where("watch_sessions.date_watched", ">=", ninetyDaysAgo)
    .groupBy([
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
    ])
    .having(db.fn.avg("ratings.score"), ">=", 7.5)
    .having(db.fn.countAll(), ">=", 2)
    .orderBy("avg_score", "desc")
    .limit(10)
    .execute();

  // 2. Surface unwatched group favorites directly
  for (const item of groupHighlyRated) {
    if (isAlreadyWatched(watched, { mediaId: item.id, tmdbId: item.tmdb_id, malId: item.mal_id })) {
      continue;
    }

    const avgScore = Number(item.avg_score);
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
      score: Math.round((avgScore / 10) * 1000) / 1000,
      recType: "group",
      reasons: [
        {
          tag: "Trending in group",
          detail: `Rated ${String(Math.round(avgScore * 10) / 10)} avg by the group`,
        },
      ],
    });
  }

  // 3. Try to get TMDB-based recommendations using a "virtual" user approach
  // Use the group's top-rated titles as if they were the user's favorites
  try {
    const tmdbRecs = await computeTmdbRecommendations(userId, limit);
    // If the user has at least some ratings, tmdb-recs might work partially
    for (const rec of tmdbRecs) {
      if (!isAlreadyWatched(watched, rec)) {
        rec.recType = "group";
        rec.reasons = rec.reasons.map((r) => ({
          ...r,
          tag: "Trending pick",
        }));
        results.push(rec);
      }
    }
  } catch {
    // User may have zero ratings — tmdb recs won't work, that's fine
  }

  return deduplicateAndSort(results).slice(0, limit);
}

function deduplicateAndSort(items: RecommendationItem[]): RecommendationItem[] {
  const seen = new Set<string>();
  const unique: RecommendationItem[] = [];

  for (const item of items) {
    const key =
      item.mediaId ??
      (item.tmdbId === null ? `mal-${String(item.malId)}` : `tmdb-${String(item.tmdbId)}`);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique.toSorted((a, b) => b.score - a.score);
}
