/**
 * POST /api/games/[id]/join — Join a multiplayer game lobby
 */

import { errorResponse, successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { logAudit } from "@/lib/auth";
import { db } from "@/lib/db";
import { publishToGame } from "@/lib/notifications/ably";
import type { PlayerJoinedEvent } from "@/types/game-responses";

const MAX_PLAYERS = 10;

export const POST = withAuth<{ id: string }>(async (_req, user, { params }) => {
  const { id: gameId } = await params;

  const session = await db
    .selectFrom("game_sessions")
    .selectAll()
    .where("id", "=", gameId)
    .executeTakeFirst();

  if (session === undefined) {
    return errorResponse("Game not found", 404);
  }

  if (session.mode !== "multiplayer") {
    return errorResponse("Cannot join a solo game", 400);
  }

  if (session.status !== "lobby") {
    return errorResponse("Game has already started", 400);
  }

  // Check if already joined
  const existing = await db
    .selectFrom("game_players")
    .select("id")
    .where("game_id", "=", gameId)
    .where("user_id", "=", user.id)
    .executeTakeFirst();

  if (existing !== undefined) {
    return errorResponse("Already joined this game", 400);
  }

  // Check player count
  const countResult = await db
    .selectFrom("game_players")
    .select(({ fn }) => fn.countAll<number>().as("count"))
    .where("game_id", "=", gameId)
    .executeTakeFirstOrThrow();

  if (countResult.count >= MAX_PLAYERS) {
    return errorResponse("Game is full (max 10 players)", 400);
  }

  // Add player
  await db
    .insertInto("game_players")
    .values({
      game_id: gameId,
      user_id: user.id,
      is_host: false,
    })
    .execute();

  void logAudit({
    userId: user.id,
    action: "game.joined",
    entityType: "game_session",
    entityId: gameId,
  });

  // Publish to Ably
  const event: PlayerJoinedEvent = {
    userId: user.id,
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
  };
  publishToGame(gameId, "player-joined", event);

  return successResponse({ joined: true }, "Joined game");
});
