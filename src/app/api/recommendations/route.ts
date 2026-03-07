/**
 * GET /api/recommendations — Get personalized or group recommendations
 *
 * Query params:
 *   type?: "content" | "collaborative" | "tmdb" | "group" — filter by rec type (omit for all)
 *   limit?: number — max items to return (default 20)
 *   refresh?: boolean — force recomputation (default false)
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import type { RecommendationType } from "@/lib/db/types";
import type { RecommendationItem } from "@/lib/recommendations";
import {
  enrichWithWatchlistData,
  getOrComputeRecommendations,
  getUserRatingCount,
  MIN_RATINGS_FOR_PERSONALIZED,
} from "@/lib/recommendations";
import { recommendationQuerySchema } from "@/lib/validations/recommendations";

export async function GET(req: NextRequest) {
  const user = await requireAuth();

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = recommendationQuerySchema.safeParse(params);
  if (!parsed.success) {
    return errorResponse("Invalid query parameters", 400);
  }

  const { type, limit, refresh } = parsed.data;

  try {
    let items: RecommendationItem[];
    let computedAt = new Date();
    let recTypeLabel: RecommendationType | "all" = type ?? "all";

    if (type === undefined) {
      // All types — check rating count for personalized vs fallback
      const ratingCount = await getUserRatingCount(user.id);
      const isPersonalized = ratingCount >= MIN_RATINGS_FOR_PERSONALIZED;

      if (isPersonalized) {
        // Fetch all 4 types in parallel
        const [content, collaborative, tmdb, group] = await Promise.all([
          getOrComputeRecommendations(user.id, "content", refresh),
          getOrComputeRecommendations(user.id, "collaborative", refresh),
          getOrComputeRecommendations(user.id, "tmdb", refresh),
          getOrComputeRecommendations(user.id, "group", refresh),
        ]);

        items = [...content, ...collaborative, ...tmdb, ...group];
      } else {
        // Fallback + group only
        const [fallback, group] = await Promise.all([
          getOrComputeRecommendations(user.id, "content", refresh), // Will get fallback internally
          getOrComputeRecommendations(user.id, "group", refresh),
        ]);

        items = [...fallback, ...group];
        recTypeLabel = "all";
      }

      // Sort merged results by score descending
      items = items.toSorted((a, b) => b.score - a.score);
    } else {
      // Single type requested
      items = await getOrComputeRecommendations(user.id, type, refresh);
    }

    // Apply limit
    items = items.slice(0, limit);

    // Enrich with watchlist data
    items = await enrichWithWatchlistData(items, user.id);

    // Determine cache expiry from the soonest TTL
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
