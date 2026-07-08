/**
 * Lazy game-session cleanup — marks abandoned lobby/active sessions.
 *
 * `game_sessions` has no player-disconnect handling once a game leaves the
 * lobby (see the round-advance stall fallback in
 * `src/app/api/games/[id]/rounds/next/route.ts` for the closest existing
 * precedent), so a session nobody finishes just sits in `lobby`/`active`
 * forever. This marks those sessions `abandoned` once they've been quiet too
 * long, keyed off real activity rather than session creation time so a
 * legitimately slow-but-live game isn't killed mid-round. Called as
 * fire-and-forget from the Play hub route, same lazy pattern as
 * `cleanupOldNotifications`.
 */

import { sql } from "kysely";

import { db } from "@/lib/db";
import type { GameStatus } from "@/lib/db/types";

/** No round has started yet, so nothing else to key a lobby timeout off. */
const LOBBY_TIMEOUT_MS = 45 * 60 * 1000;

/** Keyed off last real round/guess activity, not session creation. */
const ACTIVE_INACTIVITY_TIMEOUT_MS = 2.5 * 60 * 60 * 1000;

interface SessionActivity {
  status: GameStatus;
  createdAt: Date;
  /** Latest of round started/ended or guess created, if any exist yet. */
  lastActivityAt: Date | null;
}

/**
 * Pure decision: should this session be marked abandoned as of `now`? Split
 * from the DB query so the threshold rules are unit-tested without a
 * database.
 */
export function isSessionAbandoned(session: SessionActivity, now: Date): boolean {
  if (session.status === "lobby") {
    return now.getTime() - session.createdAt.getTime() > LOBBY_TIMEOUT_MS;
  }

  if (session.status === "active") {
    const lastActivity = session.lastActivityAt ?? session.createdAt;
    return now.getTime() - lastActivity.getTime() > ACTIVE_INACTIVITY_TIMEOUT_MS;
  }

  return false;
}

/**
 * Find and mark abandoned every stale lobby/active session (solo and
 * multiplayer alike — both have the identical staleness problem). Returns
 * the count actually written, for callers that report it (the backfill CLI).
 */
export async function cleanupAbandonedGameSessions(): Promise<number> {
  const now = new Date();

  const candidates = await db
    .selectFrom("game_sessions")
    .leftJoin("game_rounds", "game_rounds.game_id", "game_sessions.id")
    .leftJoin("game_guesses", "game_guesses.round_id", "game_rounds.id")
    .select((eb) => [
      "game_sessions.id",
      "game_sessions.status",
      "game_sessions.created_at",
      eb.fn
        .max(
          sql<Date>`greatest(${eb.ref("game_rounds.started_at")}, ${eb.ref("game_rounds.ended_at")}, ${eb.ref("game_guesses.created_at")})`,
        )
        .as("last_activity_at"),
    ])
    .where("game_sessions.status", "in", ["lobby", "active"])
    .groupBy(["game_sessions.id", "game_sessions.status", "game_sessions.created_at"])
    .execute();

  const abandonedIds = candidates
    .filter((session) =>
      isSessionAbandoned(
        {
          status: session.status,
          createdAt: session.created_at,
          lastActivityAt: session.last_activity_at,
        },
        now,
      ),
    )
    .map((session) => session.id);

  if (abandonedIds.length === 0) {
    return 0;
  }

  await db
    .updateTable("game_sessions")
    .set({ status: "abandoned", finished_at: now })
    .where("id", "in", abandonedIds)
    .execute();

  return abandonedIds.length;
}
