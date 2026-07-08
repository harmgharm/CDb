/**
 * GET /api/games/hub — Data for the Play hub's leaderboard + live-now sections
 */

import { successResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth";
import { cleanupAbandonedGameSessions } from "@/lib/games/cleanup";
import { fetchGroupLeaderboard } from "@/lib/games/leaderboard";
import { fetchLiveSessions } from "@/lib/games/live-sessions";
import type { PlayHubResponse } from "@/types/game-responses";

const LEADERBOARD_LIMIT = 5;

export async function GET() {
  await requireAuth();

  // Lazy cleanup — fire-and-forget, never blocks the response
  void cleanupAbandonedGameSessions().catch((error: unknown) => {
    console.error("Failed to cleanup abandoned game sessions:", error);
  });

  const [leaderboardEntries, liveSessions] = await Promise.all([
    fetchGroupLeaderboard(LEADERBOARD_LIMIT),
    fetchLiveSessions(),
  ]);

  const response: PlayHubResponse = {
    leaderboard: leaderboardEntries.map((entry, index) => ({
      rank: index + 1,
      userId: entry.userId,
      username: entry.username,
      displayName: entry.displayName,
      avatarUrl: entry.avatarUrl,
      gamesWon: entry.gamesWon,
      gamesPlayed: entry.gamesPlayed,
      winRate: entry.winRate,
    })),
    liveSessions,
  };

  return successResponse(response);
}
