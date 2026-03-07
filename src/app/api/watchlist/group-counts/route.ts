/**
 * GET /api/watchlist/group-counts — Batch fetch watchlist counts per media
 *
 * Returns how many users have each media in their watchlist.
 * Only counts imported media (media_id not null).
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  await requireAuth();

  const mediaIds = req.nextUrl.searchParams.getAll("mediaIds[]");
  if (mediaIds.length === 0) {
    return errorResponse("mediaIds[] query parameter is required", 400);
  }

  const results = await db
    .selectFrom("watchlist")
    .select(["media_id", db.fn.countAll().as("count")])
    .where("media_id", "in", mediaIds)
    .groupBy("media_id")
    .execute();

  const counts: Record<string, number> = {};
  for (const row of results) {
    if (row.media_id !== null) {
      counts[row.media_id] = Number(row.count);
    }
  }

  return successResponse(counts);
}
