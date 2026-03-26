/**
 * Individual signal computers for the prediction engine.
 *
 * Each function returns a SignalResult with a predicted score (1-10),
 * the effective weight, and a human-readable explanation.
 * Returns null score when insufficient data is available.
 */

import { db } from "@/lib/db";
import { pearsonCorrelation } from "@/lib/recommendations/math";

import type { ResolvedMedia, SignalResult, UserAffinityData } from "./types";

// ============================================
// 1. Collaborative Signal (weight: 0.30)
// ============================================

interface UserRating {
  mediaId: string;
  score: number;
}

interface SimilarUserRating {
  correlation: number;
  score: number;
  displayName: string;
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

/** Check if a user rated the target media by mediaId. */
function findTargetScore(ratings: UserRating[], media: ResolvedMedia): number | null {
  if (media.mediaId === null) return null;
  const found = ratings.find((r) => r.mediaId === media.mediaId);
  return found?.score ?? null;
}

/** Compute similarity between the current user and another user, returning a rating if they rated the target. */
async function checkSimilarUser(
  other: { id: string; username: string; display_name: string | null },
  userRatingMap: Map<string, number>,
  media: ResolvedMedia,
): Promise<SimilarUserRating | null> {
  const otherRatings = await getUserRatings(other.id);
  const otherRatingMap = new Map(otherRatings.map((r) => [r.mediaId, r.score]));

  const sharedMediaIds: string[] = [];
  for (const mediaId of userRatingMap.keys()) {
    if (otherRatingMap.has(mediaId)) {
      sharedMediaIds.push(mediaId);
    }
  }

  if (sharedMediaIds.length < 3) return null;

  const userScores = sharedMediaIds.map((id) => userRatingMap.get(id) ?? 0);
  const otherScores = sharedMediaIds.map((id) => otherRatingMap.get(id) ?? 0);
  const correlation = pearsonCorrelation(userScores, otherScores);

  if (correlation <= 0.3) return null;

  const targetScore = findTargetScore(otherRatings, media);
  if (targetScore === null) return null;

  return {
    correlation,
    score: targetScore,
    displayName: other.display_name ?? other.username,
  };
}

/** Build the detail string for the collaborative signal. */
function buildCollaborativeDetail(
  similarRatings: SimilarUserRating[],
  predictedScore: number,
): string {
  const rounded = String(Math.round(predictedScore * 10) / 10);
  if (similarRatings.length === 1) {
    const first = similarRatings[0];
    return `@${first?.displayName ?? "user"} with similar taste rated this ${rounded}`;
  }
  return `${String(similarRatings.length)} users with similar taste averaged ${rounded}`;
}

/**
 * Find similar users and check if any rated the target media.
 * Returns a weighted average of similar users' scores for this title.
 */
export async function computeCollaborativeSignal(
  userId: string,
  media: ResolvedMedia,
): Promise<SignalResult> {
  const userRatings = await getUserRatings(userId);
  if (userRatings.length < 3) {
    return { score: null, weight: 0, detail: "Not enough ratings for taste matching" };
  }

  const userRatingMap = new Map(userRatings.map((r) => [r.mediaId, r.score]));

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

  const similarRatings: SimilarUserRating[] = [];
  for (const other of otherUsers) {
    const result = await checkSimilarUser(other, userRatingMap, media);
    if (result !== null) {
      similarRatings.push(result);
    }
  }

  if (similarRatings.length === 0) {
    return { score: null, weight: 0, detail: "No users with similar taste have rated this" };
  }

  let totalWeight = 0;
  let weightedSum = 0;
  for (const sr of similarRatings) {
    weightedSum += sr.score * sr.correlation;
    totalWeight += sr.correlation;
  }

  const predictedScore = weightedSum / totalWeight;
  const detail = buildCollaborativeDetail(similarRatings, predictedScore);

  return { score: Math.round(predictedScore * 10) / 10, weight: 0.3, detail };
}

// ============================================
// 2. Genre Signal (weight: 0.25)
// ============================================

/**
 * Predict based on user's genre preferences.
 * Weighted average of user's avg ratings for matching genres.
 */
export function computeGenreSignal(affinity: UserAffinityData, media: ResolvedMedia): SignalResult {
  if (media.genres.length === 0) {
    return { score: null, weight: 0, detail: "No genre data available" };
  }

  let totalWeight = 0;
  let weightedSum = 0;
  const matchedGenres: string[] = [];

  for (const genre of media.genres) {
    const entry = affinity.genreScores.get(genre);
    if (entry !== undefined) {
      weightedSum += entry.avg * entry.count;
      totalWeight += entry.count;
      matchedGenres.push(`${genre} (${String(Math.round(entry.avg * 10) / 10)} avg)`);
    }
  }

  if (totalWeight === 0) {
    return { score: null, weight: 0, detail: "You haven't rated titles in these genres yet" };
  }

  const predictedScore = weightedSum / totalWeight;
  const topGenres = matchedGenres.slice(0, 3).join(", ");

  return {
    score: Math.round(predictedScore * 10) / 10,
    weight: 0.25,
    detail: `Based on your ratings: ${topGenres}`,
  };
}

// ============================================
// 3. Director Signal (weight: 0.15)
// ============================================

/**
 * Predict based on user's director preferences.
 * Uses the best matching director's average.
 */
export function computeDirectorSignal(
  affinity: UserAffinityData,
  media: ResolvedMedia,
): SignalResult {
  if (media.directors.length === 0) {
    return { score: null, weight: 0, detail: "No director data available" };
  }

  let bestMatch: { director: string; avg: number; count: number } | null = null;

  for (const director of media.directors) {
    const entry = affinity.directorScores.get(director);
    if (entry !== undefined && (bestMatch === null || entry.count > bestMatch.count)) {
      bestMatch = { director, avg: entry.avg, count: entry.count };
    }
  }

  if (bestMatch === null) {
    const directorNames = media.directors.slice(0, 2).join(", ");
    return {
      score: null,
      weight: 0,
      detail: `You haven't rated other work by ${directorNames}`,
    };
  }

  const countLabel = bestMatch.count === 1 ? "title" : "titles";
  const detail = `You rate ${bestMatch.director}'s work ${String(Math.round(bestMatch.avg * 10) / 10)} avg (${String(bestMatch.count)} ${countLabel})`;

  return { score: Math.round(bestMatch.avg * 10) / 10, weight: 0.15, detail };
}

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

// ============================================
// 4. External Rating Signal (weight: 0.10)
// ============================================

/**
 * Use TMDB/MAL community rating as a baseline anchor.
 */
export function computeExternalSignal(media: ResolvedMedia): SignalResult {
  if (media.voteAverage === null || media.voteAverage === 0) {
    return { score: null, weight: 0, detail: "No community rating available" };
  }

  const source = media.malId !== null && media.tmdbId === null ? "MAL" : "TMDB";
  const rounded = String(Math.round(media.voteAverage * 10) / 10);

  return {
    score: Math.round(media.voteAverage * 10) / 10,
    weight: 0.1,
    detail: `${source} community rating: ${rounded}/10`,
  };
}

// ============================================
// 5. Group Signal (weight: 0.10)
// ============================================

interface GroupRatingResult {
  average: number;
  count: number;
}

async function getGroupRatings(media: ResolvedMedia): Promise<GroupRatingResult | null> {
  if (media.mediaId === null) return null;

  const result = await db
    .selectFrom("ratings")
    .innerJoin("watch_sessions", "watch_sessions.id", "ratings.session_id")
    .select([db.fn.avg("ratings.score").as("avg_score"), db.fn.countAll().as("rating_count")])
    .where("watch_sessions.media_id", "=", media.mediaId)
    .executeTakeFirst();

  if (result === undefined || Number(result.rating_count) === 0) return null;

  return {
    average: Math.round(Number(result.avg_score) * 10) / 10,
    count: Number(result.rating_count),
  };
}

/**
 * Use the group's actual ratings for this media as a signal.
 */
export async function computeGroupSignal(media: ResolvedMedia): Promise<SignalResult> {
  const groupRatings = await getGroupRatings(media);

  if (groupRatings === null) {
    return { score: null, weight: 0, detail: "Your group hasn't watched this yet" };
  }

  const countLabel = groupRatings.count === 1 ? "rating" : "ratings";
  const detail = `Your group rated this ${String(groupRatings.average)} avg (${String(groupRatings.count)} ${countLabel})`;

  return { score: groupRatings.average, weight: 0.1, detail };
}

/**
 * Get group rating data for use in the prediction result.
 * Separate from the signal so we always return it for comparison.
 */
export async function getGroupRatingData(
  media: ResolvedMedia,
): Promise<{ average: number | null; count: number }> {
  const result = await getGroupRatings(media);
  return {
    average: result?.average ?? null,
    count: result?.count ?? 0,
  };
}

// ============================================
// 6. Era/Format Signal (weight: 0.10)
// ============================================

interface SubSignal {
  score: number;
  detail: string;
}

const RUNTIME_BUCKET_LABELS: Record<string, string> = {
  short: "shorter (<100 min)",
  medium: "medium-length (100-150 min)",
  long: "longer (150+ min)",
};

const FORMAT_LABELS: Record<string, string> = {
  movie: "movies",
  tv: "TV shows",
  anime: "anime",
};

function getRuntimeBucket(minutes: number): string {
  if (minutes < 100) return "short";
  if (minutes <= 150) return "medium";
  return "long";
}

function collectDecadeSubSignal(
  affinity: UserAffinityData,
  media: ResolvedMedia,
): SubSignal | null {
  if (media.releaseYear === null) return null;
  const decade = Math.floor(media.releaseYear / 10) * 10;
  const entry = affinity.decadeScores.get(decade);
  if (entry === undefined || entry.count < 2) return null;
  return {
    score: entry.avg,
    detail: `You rate ${String(decade)}s titles ${String(Math.round(entry.avg * 10) / 10)} avg`,
  };
}

function collectRuntimeSubSignal(
  affinity: UserAffinityData,
  media: ResolvedMedia,
): SubSignal | null {
  if (media.runtimeMinutes === null) return null;
  const bucket = getRuntimeBucket(media.runtimeMinutes);
  const entry = affinity.runtimeBucketScores.get(bucket);
  if (entry === undefined || entry.count < 2) return null;
  return {
    score: entry.avg,
    detail: `You rate ${RUNTIME_BUCKET_LABELS[bucket] ?? bucket} titles ${String(Math.round(entry.avg * 10) / 10)} avg`,
  };
}

function collectFormatSubSignal(
  affinity: UserAffinityData,
  media: ResolvedMedia,
): SubSignal | null {
  const entry = affinity.formatScores.get(media.mediaType);
  if (entry === undefined || entry.count < 2) return null;
  return {
    score: entry.avg,
    detail: `You rate ${FORMAT_LABELS[media.mediaType] ?? media.mediaType} ${String(Math.round(entry.avg * 10) / 10)} avg`,
  };
}

/**
 * Predict based on decade preference, runtime preference, and format preference.
 * Blends available sub-signals equally within the era weight.
 */
export function computeEraSignal(affinity: UserAffinityData, media: ResolvedMedia): SignalResult {
  const collectors = [
    collectDecadeSubSignal(affinity, media),
    collectRuntimeSubSignal(affinity, media),
    collectFormatSubSignal(affinity, media),
  ];
  const subSignals = collectors.filter((s): s is SubSignal => s !== null);

  if (subSignals.length === 0) {
    return { score: null, weight: 0, detail: "Not enough data for era/format analysis" };
  }

  const avgScore = subSignals.reduce((sum, s) => sum + s.score, 0) / subSignals.length;
  const detail = subSignals.map((s) => s.detail).join("; ");

  return { score: Math.round(avgScore * 10) / 10, weight: 0.1, detail };
}
