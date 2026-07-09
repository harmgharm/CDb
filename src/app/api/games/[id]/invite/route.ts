/**
 * POST /api/games/[id]/invite — Invite players to a multiplayer game lobby
 *
 * Creates a notification for each invited user with a link to the lobby.
 */

import type { NextRequest } from "next/server";

import { errorResponse, successResponse } from "@/lib/api/response";
import { getAuthUser, logAudit } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEngine } from "@/lib/games";
import { createNotification } from "@/lib/notifications/create";
import { invitePlayersSchema } from "@/lib/validations/games";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser();
  if (!user) {
    return errorResponse("Not authenticated", 401);
  }
  const { id: gameId } = await params;

  const body: unknown = await req.json();
  const parsed = invitePlayersSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { userIds } = parsed.data;

  const session = await db
    .selectFrom("game_sessions")
    .selectAll()
    .where("id", "=", gameId)
    .executeTakeFirst();

  if (session === undefined) {
    return errorResponse("Game not found", 404);
  }

  if (session.created_by_user_id !== user.id) {
    return errorResponse("Only the host can invite players", 403);
  }

  if (session.mode !== "multiplayer") {
    return errorResponse("Cannot invite to a solo game", 400);
  }

  if (session.status !== "lobby") {
    return errorResponse("Game has already started", 400);
  }

  // Filter out already-joined players and the host
  const existingPlayers = await db
    .selectFrom("game_players")
    .select("user_id")
    .where("game_id", "=", gameId)
    .execute();

  const existingIds = new Set(existingPlayers.map((p) => p.user_id));
  const newUserIds = userIds.filter((id) => !existingIds.has(id));

  if (newUserIds.length === 0) {
    return successResponse({ invited: 0 }, "All selected users are already in the game");
  }

  const engine = getEngine(session.game_type);
  const hostName = user.display_name ?? user.username;

  // Create notifications for each invited user
  await Promise.all(
    newUserIds.map(async (userId) =>
      createNotification({
        userId,
        type: "game.invited",
        title: `Game Invite: ${engine.displayName}`,
        body: `${hostName} invited you to play ${engine.displayName}!`,
        link: `${engine.basePath}/${gameId}`,
        metadata: { gameId, hostUserId: user.id, hostName },
      }),
    ),
  );

  void logAudit({
    userId: user.id,
    action: "game.invited",
    entityType: "game_session",
    entityId: gameId,
    metadata: { invitedUserIds: newUserIds },
  });

  return successResponse(
    { invited: newUserIds.length },
    `Invited ${String(newUserIds.length)} player${newUserIds.length === 1 ? "" : "s"}`,
  );
}
