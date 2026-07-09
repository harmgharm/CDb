/**
 * POST /api/games/[id]/rematch — Create a rematch with the same settings
 *
 * Creates a new lobby game with identical settings to the finished game.
 * Publishes a "rematch-created" event on the old game's Ably channel
 * so all players can join the new lobby.
 */

import { errorResponse, successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { logAudit } from "@/lib/auth";
import { db } from "@/lib/db";
import { isRankedGame } from "@/lib/games/ranked-presets";
import { publishToGame } from "@/lib/notifications/ably";
import type { RematchCreatedEvent } from "@/types/game-responses";

export const POST = withAuth<{ id: string }>(async (_req, user, { params }) => {
  const { id: gameId } = await params;

  // Fetch the original game
  const original = await db
    .selectFrom("game_sessions")
    .selectAll()
    .where("id", "=", gameId)
    .executeTakeFirst();

  if (original === undefined) {
    return errorResponse("Game not found", 404);
  }

  if (original.mode !== "multiplayer") {
    return errorResponse("Rematch is only available for multiplayer games", 400);
  }

  if (original.status !== "finished") {
    return errorResponse("Game is not finished yet", 400);
  }

  // Verify requesting user was a player in the original game
  const wasPlayer = await db
    .selectFrom("game_players")
    .select("id")
    .where("game_id", "=", gameId)
    .where("user_id", "=", user.id)
    .executeTakeFirst();

  if (wasPlayer === undefined) {
    return errorResponse("You were not in this game", 403);
  }

  // Create the new game with same settings
  const ranked = isRankedGame(original.game_type, original.difficulty, original.round_count);

  const newSession = await db
    .insertInto("game_sessions")
    .values({
      game_type: original.game_type,
      mode: "multiplayer",
      difficulty: original.difficulty,
      status: "lobby",
      round_count: original.round_count,
      current_round: 0,
      created_by_user_id: user.id,
      is_ranked: ranked,
      time_limit_seconds: original.time_limit_seconds,
      started_at: null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  // Add requesting user as host
  await db
    .insertInto("game_players")
    .values({
      game_id: newSession.id,
      user_id: user.id,
      is_host: true,
    })
    .execute();

  void logAudit({
    userId: user.id,
    action: "game.created",
    entityType: "game_session",
    entityId: newSession.id,
    metadata: {
      gameType: original.game_type,
      difficulty: original.difficulty,
      roundCount: original.round_count,
      mode: "multiplayer",
      rematchOf: gameId,
    },
  });

  // Publish rematch event on the OLD game's channel so all players see it
  const event: RematchCreatedEvent = {
    newGameId: newSession.id,
    createdBy: {
      userId: user.id,
      username: user.username,
      displayName: user.display_name,
    },
  };
  publishToGame(gameId, "rematch-created", event);

  return successResponse({ newGameId: newSession.id }, "Rematch created", 201);
});
