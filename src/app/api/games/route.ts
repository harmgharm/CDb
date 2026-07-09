/**
 * POST /api/games — Create a game (solo auto-starts, multiplayer creates lobby)
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAuthUser, logAudit } from "@/lib/auth";
import { withTransaction } from "@/lib/db/transaction";
import { getEngine } from "@/lib/games";
import type { RoundPoolItem } from "@/lib/games/engine";
import { isRankedGame } from "@/lib/games/ranked-presets";
import { createGameSchema } from "@/lib/validations/games";
import type { GameRoundResponse, GameSessionResponse } from "@/types/game-responses";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return errorResponse("Not authenticated", 401);
  }

  const body: unknown = await req.json();
  const parsed = createGameSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { gameType, mode, difficulty, roundCount, timeLimitSeconds } = parsed.data;
  const engine = getEngine(gameType);
  const isMultiplayer = mode === "multiplayer";
  const ranked = isRankedGame(gameType, difficulty, roundCount);

  // Solo: build pool now. Multiplayer: defer to /start
  let pool: RoundPoolItem[] | undefined;
  if (!isMultiplayer) {
    try {
      pool = await engine.buildPool(difficulty, roundCount);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to build game pool";
      return errorResponse(message, 400);
    }
  }

  const now = new Date();

  const result = await withTransaction(async (trx) => {
    // Create game session
    const session = await trx
      .insertInto("game_sessions")
      .values({
        game_type: gameType,
        mode,
        difficulty,
        status: isMultiplayer ? "lobby" : "active",
        round_count: roundCount,
        current_round: 0,
        created_by_user_id: user.id,
        is_ranked: ranked,
        time_limit_seconds: timeLimitSeconds ?? null,
        started_at: isMultiplayer ? null : now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Multiplayer: add host as first player
    if (isMultiplayer) {
      await trx
        .insertInto("game_players")
        .values({
          game_id: session.id,
          user_id: user.id,
          is_host: true,
        })
        .execute();
    }

    // Solo: create all rounds upfront
    let rounds: {
      id: string;
      round_number: number;
      round_data: Record<string, unknown>;
      started_at: Date | null;
      ended_at: Date | null;
      first_correct_at: Date | null;
    }[] = [];
    if (!isMultiplayer && pool !== undefined) {
      const roundValues = pool.map((item, index) => ({
        game_id: session.id,
        round_number: index,
        round_data: JSON.stringify(item.roundData),
        started_at: index === 0 ? now : null,
      }));

      rounds = await trx.insertInto("game_rounds").values(roundValues).returningAll().execute();
    }

    return { session, rounds };
  });

  void logAudit({
    userId: user.id,
    action: "game.created",
    entityType: "game_session",
    entityId: result.session.id,
    metadata: { gameType, difficulty, roundCount, mode },
  });

  // Build response — use engine masking for round data
  const roundResponses: GameRoundResponse[] = result.rounds.map((round) => {
    const phase = round.started_at === null ? "not_started" : "active";
    const roundData = round.round_data;
    const masked = engine.maskRoundData(roundData, phase);

    return {
      id: round.id,
      roundNumber: round.round_number,
      roundData: masked,
      startedAt: round.started_at?.toISOString() ?? null,
      endedAt: round.ended_at?.toISOString() ?? null,
      firstCorrectAt: null,
      guesses: [],
    };
  });

  const response: GameSessionResponse = {
    id: result.session.id,
    gameType: result.session.game_type,
    mode: result.session.mode,
    difficulty: result.session.difficulty,
    status: result.session.status,
    roundCount: result.session.round_count,
    currentRound: result.session.current_round,
    createdByUserId: result.session.created_by_user_id,
    isRanked: result.session.is_ranked,
    timeLimitSeconds: result.session.time_limit_seconds,
    startedAt: result.session.started_at?.toISOString() ?? null,
    finishedAt: result.session.finished_at?.toISOString() ?? null,
    createdAt: result.session.created_at.toISOString(),
    rounds: roundResponses,
    totalScore: 0,
    currentStreak: 0,
    ...(isMultiplayer
      ? {
          players: [
            {
              userId: user.id,
              username: user.username,
              displayName: user.display_name,
              avatarUrl: user.avatar_url,
              isHost: true,
              joinedAt: new Date().toISOString(),
              totalScore: 0,
              roundsWon: 0,
              currentStreak: 0,
            },
          ],
        }
      : {}),
  };

  return successResponse(response, "Game created", 201);
}
