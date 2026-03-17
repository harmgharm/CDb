/**
 * GET /api/games/leaderboard — Paginated leaderboard sorted by total score
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { getLeaderboard } from "@/lib/games/leaderboard";
import { leaderboardQuerySchema } from "@/lib/validations/games";
import type { LeaderboardEntryResponse, LeaderboardResponse } from "@/types/game-responses";

export async function GET(req: NextRequest) {
  await requireAuth();

  const queryParams = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = leaderboardQuerySchema.safeParse(queryParams);
  if (!parsed.success) {
    return errorResponse("Invalid query parameters", 400);
  }

  const { page, limit } = parsed.data;
  const result = await getLeaderboard(page, limit);

  const entries: LeaderboardEntryResponse[] = result.entries.map((entry, index) => ({
    rank: (page - 1) * limit + index + 1,
    userId: entry.userId,
    username: entry.username,
    displayName: entry.displayName,
    avatarUrl: entry.avatarUrl,
    gamesPlayed: entry.gamesPlayed,
    gamesWon: entry.gamesWon,
    roundsWon: entry.roundsWon,
    totalScore: entry.totalScore,
    bestStreak: entry.bestStreak,
    avgGuessTimeMs: entry.avgGuessTimeMs,
  }));

  const response: LeaderboardResponse = {
    entries,
    total: result.total,
    page,
    limit,
  };

  return successResponse(response);
}
