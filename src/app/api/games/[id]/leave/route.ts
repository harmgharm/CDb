/**
 * POST /api/games/[id]/leave — Leave a multiplayer game lobby
 *
 * Removes the player from game_players.
 * If the host leaves, the lobby is closed (status → "finished")
 * and a "lobby-closed" event is published so remaining players are notified.
 */

import { errorResponse, successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import { logAudit } from "@/lib/auth";
import { db } from "@/lib/db";
import { publishToGame } from "@/lib/notifications/ably";
import type { LobbyClosed, PlayerLeftEvent } from "@/types/game-responses";

export const POST = withAuth<{ id: string }>(async (_req, user, { params }) => {
  const { id: gameId } = await params;

  const session = await db
    .selectFrom("game_sessions")
    .select(["status", "mode", "created_by_user_id"])
    .where("id", "=", gameId)
    .executeTakeFirst();

  if (session === undefined) {
    return errorResponse("Game not found", 404);
  }

  if (session.mode !== "multiplayer") {
    return errorResponse("Cannot leave a solo game", 400);
  }

  // Only allow leaving from the lobby — once a game is active, players stay
  if (session.status !== "lobby") {
    return errorResponse("Cannot leave a game in progress", 400);
  }

  // Verify user is actually in this game
  const player = await db
    .selectFrom("game_players")
    .select("id")
    .where("game_id", "=", gameId)
    .where("user_id", "=", user.id)
    .executeTakeFirst();

  if (player === undefined) {
    return errorResponse("You are not in this game", 400);
  }

  const isHost = session.created_by_user_id === user.id;

  if (isHost) {
    // Host leaving → close the entire lobby
    await db
      .updateTable("game_sessions")
      .set({ status: "finished", finished_at: new Date() })
      .where("id", "=", gameId)
      .execute();

    // Remove all players
    await db.deleteFrom("game_players").where("game_id", "=", gameId).execute();

    void logAudit({
      userId: user.id,
      action: "game.lobby_closed",
      entityType: "game_session",
      entityId: gameId,
      metadata: { reason: "host_left" },
    });

    const event: LobbyClosed = { reason: "host_left" };
    publishToGame(gameId, "lobby-closed", event);
  } else {
    // Non-host leaving → just remove them
    await db
      .deleteFrom("game_players")
      .where("game_id", "=", gameId)
      .where("user_id", "=", user.id)
      .execute();

    void logAudit({
      userId: user.id,
      action: "game.left",
      entityType: "game_session",
      entityId: gameId,
    });

    const event: PlayerLeftEvent = { userId: user.id };
    publishToGame(gameId, "player-left", event);
  }

  return successResponse({ left: true }, isHost ? "Lobby closed" : "Left game");
});
