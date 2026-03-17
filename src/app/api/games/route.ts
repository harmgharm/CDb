/**
 * POST /api/games — Create and auto-start a solo game
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { logAudit, requireAuth } from "@/lib/auth";
import { withTransaction } from "@/lib/db/transaction";
import { buildMediaPool } from "@/lib/games/media-pool";
import { createGameSchema } from "@/lib/validations/games";
import type { GameRoundResponse, GameSessionResponse } from "@/types/game-responses";

export async function POST(req: NextRequest) {
  const user = await requireAuth();

  const body: unknown = await req.json();
  const parsed = createGameSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { difficulty, roundCount } = parsed.data;

  // Build media pool before transaction (may call external APIs for hard mode)
  let pool;
  try {
    pool = await buildMediaPool(difficulty, roundCount);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to build media pool";
    return errorResponse(message, 400);
  }

  const now = new Date();

  const result = await withTransaction(async (trx) => {
    // Create game session — auto-started for solo
    const session = await trx
      .insertInto("game_sessions")
      .values({
        mode: "solo",
        difficulty,
        status: "active",
        round_count: roundCount,
        current_round: 0,
        created_by_user_id: user.id,
        started_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Create all rounds upfront
    const roundValues = pool.map((item, index) => ({
      game_id: session.id,
      round_number: index,
      media_id: item.id,
      tmdb_id: item.tmdbId,
      mal_id: item.malId,
      poster_url: item.posterUrl,
      title: item.title,
      started_at: index === 0 ? now : null,
    }));

    const rounds = await trx.insertInto("game_rounds").values(roundValues).returningAll().execute();

    return { session, rounds };
  });

  void logAudit({
    userId: user.id,
    action: "game.created",
    entityType: "game_session",
    entityId: result.session.id,
    metadata: { difficulty, roundCount, mode: "solo" },
  });

  // Build response — only reveal first round's poster, redact future rounds
  const roundResponses: GameRoundResponse[] = result.rounds.map((round) => ({
    id: round.id,
    roundNumber: round.round_number,
    posterUrl: round.round_number === 0 ? round.poster_url : null,
    title: null, // Never reveal title upfront
    mediaId: round.round_number === 0 ? round.media_id : null,
    tmdbId: round.round_number === 0 ? round.tmdb_id : null,
    malId: round.round_number === 0 ? round.mal_id : null,
    startedAt: round.started_at?.toISOString() ?? null,
    endedAt: round.ended_at?.toISOString() ?? null,
    guesses: [],
  }));

  const response: GameSessionResponse = {
    id: result.session.id,
    mode: result.session.mode,
    difficulty: result.session.difficulty,
    status: result.session.status,
    roundCount: result.session.round_count,
    currentRound: result.session.current_round,
    createdByUserId: result.session.created_by_user_id,
    startedAt: result.session.started_at?.toISOString() ?? null,
    finishedAt: result.session.finished_at?.toISOString() ?? null,
    createdAt: result.session.created_at.toISOString(),
    rounds: roundResponses,
    totalScore: 0,
    currentStreak: 0,
  };

  return successResponse(response, "Game created", 201);
}
