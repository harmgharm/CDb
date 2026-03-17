/**
 * POST /api/games/[id]/rounds/next — Advance to the next round or finish the game
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withTransaction } from "@/lib/db/transaction";
import { updateLeaderboard } from "@/lib/games/leaderboard";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id: gameId } = await params;

  const session = await db
    .selectFrom("game_sessions")
    .selectAll()
    .where("id", "=", gameId)
    .executeTakeFirst();

  if (session === undefined) {
    return errorResponse("Game not found", 404);
  }

  if (session.status !== "active") {
    return errorResponse("Game is not active", 400);
  }

  if (session.created_by_user_id !== user.id) {
    return errorResponse("Only the game creator can advance rounds", 403);
  }

  const now = new Date();
  const nextRoundNumber = session.current_round + 1;
  const isLastRound = nextRoundNumber >= session.round_count;

  await withTransaction(async (trx) => {
    // End the current round
    await trx
      .updateTable("game_rounds")
      .set({ ended_at: now })
      .where("game_id", "=", gameId)
      .where("round_number", "=", session.current_round)
      .execute();

    if (isLastRound) {
      // Game is over
      await trx
        .updateTable("game_sessions")
        .set({
          status: "finished",
          finished_at: now,
        })
        .where("id", "=", gameId)
        .execute();
    } else {
      // Advance to next round
      await trx
        .updateTable("game_sessions")
        .set({ current_round: nextRoundNumber })
        .where("id", "=", gameId)
        .execute();

      // Start the next round
      await trx
        .updateTable("game_rounds")
        .set({ started_at: now })
        .where("game_id", "=", gameId)
        .where("round_number", "=", nextRoundNumber)
        .execute();
    }
  });

  // If game finished, update leaderboard
  if (isLastRound) {
    void (async () => {
      try {
        // Gather stats from all guesses
        const guesses = await db
          .selectFrom("game_guesses")
          .innerJoin("game_rounds", "game_rounds.id", "game_guesses.round_id")
          .select([
            "game_guesses.is_correct",
            "game_guesses.score_awarded",
            "game_guesses.time_from_start_ms",
          ])
          .where("game_rounds.game_id", "=", gameId)
          .where("game_guesses.user_id", "=", user.id)
          .execute();

        let totalScore = 0;
        let roundsWon = 0;
        let bestStreak = 0;
        let currentStreak = 0;
        let totalCorrectTime = 0;
        let correctCount = 0;

        for (const guess of guesses) {
          totalScore += guess.score_awarded;
          if (guess.is_correct) {
            roundsWon += 1;
            currentStreak += 1;
            bestStreak = Math.max(bestStreak, currentStreak);
            totalCorrectTime += guess.time_from_start_ms;
            correctCount += 1;
          } else {
            currentStreak = 0;
          }
        }

        const avgGuessTimeMs = correctCount > 0 ? Math.round(totalCorrectTime / correctCount) : 0;

        await updateLeaderboard({
          userId: user.id,
          roundsWon,
          totalScore,
          bestStreak,
          avgGuessTimeMs,
          isWinner: true, // Solo games — player always "wins"
        });

        await logAudit({
          userId: user.id,
          action: "game.finished",
          entityType: "game_session",
          entityId: gameId,
          metadata: { totalScore, roundsWon, bestStreak },
        });
      } catch (error: unknown) {
        console.error("Failed to update leaderboard:", error);
      }
    })();
  }

  return successResponse({ advanced: !isLastRound, finished: isLastRound });
}
