/**
 * POST /api/recommendations/similar — Find titles similar to user-selected sources
 *
 * Body:
 *   sources: Array<{ tmdbId?, malId?, mediaType, title }> — 1-5 source titles
 *   limit?: number — max items to return (default 20)
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { computeSimilarRecommendations, enrichWithWatchlistData } from "@/lib/recommendations";
import { findSimilarRequestSchema } from "@/lib/validations/recommendations";

export async function POST(request: NextRequest): Promise<Response> {
  const user = await requireAuth();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const parsed = findSimilarRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid request body", 400);
  }

  const { sources, limit } = parsed.data;

  try {
    let items = await computeSimilarRecommendations(user.id, sources, limit);
    items = await enrichWithWatchlistData(items, user.id);

    return successResponse({
      items,
      meta: {
        type: "similar" as const,
        computedAt: new Date().toISOString(),
        sourceCount: sources.length,
        sources: sources.map((source) => ({
          title: source.title,
          mediaType: source.mediaType,
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to find similar titles";
    return errorResponse(message, 500);
  }
}
