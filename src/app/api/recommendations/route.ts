/**
 * GET /api/recommendations — Get personalized or group recommendations
 *
 * Query params:
 *   type?: "content" | "collaborative" | "tmdb" | "group" — filter by rec type (omit for all)
 *   limit?: number — max items to return (default 60)
 *   refresh?: boolean — force recomputation (default false)
 *   mediaType?: "movie" | "tv" | "anime" — server-side media type filter
 *   genre?: string — server-side genre filter (e.g., "Action")
 *   decade?: string — server-side decade filter (e.g., "2020" or "older")
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import type { MediaType, RecommendationType } from "@/lib/db/types";
import type { RecommendationItem } from "@/lib/recommendations";
import {
  enrichWithWatchlistData,
  getOrComputeRecommendations,
  getUserDismissedIds,
  getUserRatingCount,
  isAlreadyWatched,
  MIN_RATINGS_FOR_PERSONALIZED,
} from "@/lib/recommendations";
import { computeFilteredRecommendations } from "@/lib/recommendations/filtered";
import { recommendationQuerySchema } from "@/lib/validations/recommendations";

/** If dismissal filtering drops a section below this, auto-backfill with fresh computation */
const BACKFILL_THRESHOLD = 15;

async function fetchAllTypes(userId: string, refresh: boolean): Promise<RecommendationItem[]> {
  const ratingCount = await getUserRatingCount(userId);
  const isPersonalized = ratingCount >= MIN_RATINGS_FOR_PERSONALIZED;

  if (isPersonalized) {
    const [content, collaborative, tmdb, group] = await Promise.all([
      getOrComputeRecommendations(userId, "content", refresh),
      getOrComputeRecommendations(userId, "collaborative", refresh),
      getOrComputeRecommendations(userId, "tmdb", refresh),
      getOrComputeRecommendations(userId, "group", refresh),
    ]);
    return [...content, ...collaborative, ...tmdb, ...group];
  }

  const [fallback, group] = await Promise.all([
    getOrComputeRecommendations(userId, "content", refresh),
    getOrComputeRecommendations(userId, "group", refresh),
  ]);
  return [...fallback, ...group];
}

export async function GET(req: NextRequest) {
  const user = await requireAuth();

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = recommendationQuerySchema.safeParse(params);
  if (!parsed.success) {
    return errorResponse("Invalid query parameters", 400);
  }

  const { type, limit, refresh, mediaType, genre, decade } = parsed.data;
  const hasFilters =
    (mediaType !== undefined && mediaType.length > 0) ||
    (genre !== undefined && genre.length > 0) ||
    (decade !== undefined && decade.length > 0);

  try {
    let items: RecommendationItem[];
    let computedAt = new Date();
    const recTypeLabel: RecommendationType | "all" = type ?? "all";

    // Pre-fetch dismissed IDs (needed for filtering + backfill)
    const dismissed = await getUserDismissedIds(user.id);

    if (hasFilters) {
      // Server-side filtered: bypass cache, compute on-the-fly with TMDB discover params
      items = await computeFilteredRecommendations(
        user.id,
        { mediaType: mediaType as MediaType[] | undefined, genre, decade },
        limit,
      );
    } else if (type === undefined) {
      // All types — check rating count for personalized vs fallback
      items = await fetchAllTypes(user.id, refresh);
      items = items.toSorted((a, b) => b.score - a.score);
    } else {
      // Single type requested (no content filters)
      items = await getOrComputeRecommendations(user.id, type, refresh);

      // Backfill: if dismissals thin a section below threshold, recompute once
      const filteredCount = items.filter((item) => !isAlreadyWatched(dismissed, item)).length;
      if (!refresh && filteredCount < BACKFILL_THRESHOLD) {
        items = await getOrComputeRecommendations(user.id, type, true);
      }
    }

    // Filter out dismissed items and apply limit
    items = items.filter((item) => !isAlreadyWatched(dismissed, item));
    items = items.slice(0, limit);

    // Enrich with watchlist data
    items = await enrichWithWatchlistData(items, user.id);

    const ratingCount = await getUserRatingCount(user.id);
    computedAt = new Date();

    return successResponse({
      items,
      meta: {
        type: recTypeLabel,
        computedAt: computedAt.toISOString(),
        isPersonalized: ratingCount >= MIN_RATINGS_FOR_PERSONALIZED,
        ratingCount,
        ratingsNeeded: Math.max(0, MIN_RATINGS_FOR_PERSONALIZED - ratingCount),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to compute recommendations";
    return errorResponse(message, 500);
  }
}
