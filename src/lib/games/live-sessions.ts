/**
 * Live multiplayer session data access
 *
 * Lists in-progress (lobby or active) multiplayer game sessions across the
 * group, for the Play hub's "Live now" card. Read-only, polled via SWR — no
 * Ably presence involved (see docs/superpowers/specs/2026-06-28-design-system-second-pass.md,
 * "Play hub" judgment calls).
 */

import { db } from "@/lib/db";
import type { GameStatus, GameType } from "@/lib/db/types";

/**
 * Recency cutoff for "Live now": `game_sessions` has no cleanup/expiry
 * mechanism today, so a lobby/active session an abandoned player never
 * finished lingers in that status forever (confirmed against the dev DB:
 * dozens of multiplayer sessions from months prior still read as "active").
 * This filter is a defensive bandage against that gap, not a fix for it — see
 * docs/superpowers/specs/2026-06-28-design-system-second-pass.md, "Play hub"
 * section, "New finding during implementation" for the real fix (a cleanup
 * job keyed off actual round/guess activity, not just created_at).
 */
const LIVE_SESSION_MAX_AGE_MS = 3 * 60 * 60 * 1000;

/**
 * Display names for the "Live now" title line. Kept local rather than
 * importing the full engine registry (`@/lib/games`) or the client-only
 * config (`@/lib/games/client-config`, which errors if called from server
 * code) — this is the one small, server-safe piece of that data this module
 * needs. Must match `ClientGameConfig.displayName` in `client-config.ts` and
 * each engine's `displayName` in `src/lib/games/engines/*.ts`.
 */
const GAME_DISPLAY_NAMES: Record<GameType, string> = {
  poster_reveal: "Poster Reveal",
  rating_guess: "Rating Guesser",
  year_guess: "Year Guesser",
};

interface LiveSessionPlayer {
  userId: string;
  username: string;
  displayName: string | null;
}

interface LiveSessionInput {
  id: string;
  gameDisplayName: string;
  status: GameStatus;
  currentRound: number;
  roundCount: number;
  players: LiveSessionPlayer[];
}

export interface LiveSession {
  id: string;
  gameType: GameType;
  title: string;
  meta: string;
  isLobby: boolean;
}

/**
 * Format one live session into its display title + meta line. Pure so the
 * text rules (1-indexed round display, lobby-vs-active wording, display-name
 * fallback) are unit-tested without a database.
 */
export function formatLiveSession(session: LiveSessionInput): Pick<LiveSession, "title" | "meta"> {
  const isLobby = session.status === "lobby";

  const title = isLobby
    ? `${session.gameDisplayName} · Lobby`
    : `${session.gameDisplayName} · Round ${String(session.currentRound + 1)} of ${String(session.roundCount)}`;

  const meta = isLobby
    ? `${String(session.players.length)} joined`
    : session.players.map((player) => player.displayName ?? player.username).join(", ");

  return { title, meta };
}

interface LiveSessionRow {
  id: string;
  game_type: GameType;
  status: GameStatus;
  current_round: number;
  round_count: number;
  user_id: string;
  username: string;
  display_name: string | null;
}

/**
 * List in-progress multiplayer sessions across the group (lobby or active),
 * newest first, each with its joined players.
 */
export async function fetchLiveSessions(): Promise<LiveSession[]> {
  const rows = await db
    .selectFrom("game_sessions")
    .innerJoin("game_players", "game_players.game_id", "game_sessions.id")
    .innerJoin("users", "users.id", "game_players.user_id")
    .select([
      "game_sessions.id",
      "game_sessions.game_type",
      "game_sessions.status",
      "game_sessions.current_round",
      "game_sessions.round_count",
      "game_players.user_id",
      "users.username",
      "users.display_name",
    ])
    .where("game_sessions.mode", "=", "multiplayer")
    .where("game_sessions.status", "in", ["lobby", "active"])
    .where("game_sessions.created_at", ">", new Date(Date.now() - LIVE_SESSION_MAX_AGE_MS))
    .orderBy("game_sessions.created_at", "desc")
    .execute();

  const sessionsById = new Map<string, LiveSessionRow[]>();
  for (const row of rows) {
    const existing = sessionsById.get(row.id) ?? [];
    existing.push(row);
    sessionsById.set(row.id, existing);
  }

  return [...sessionsById.values()].map((sessionRows) => {
    const [first] = sessionRows;
    if (first === undefined) {
      throw new Error("Unreachable: grouped session with no rows");
    }

    const { title, meta } = formatLiveSession({
      id: first.id,
      gameDisplayName: GAME_DISPLAY_NAMES[first.game_type],
      status: first.status,
      currentRound: first.current_round,
      roundCount: first.round_count,
      players: sessionRows.map((row) => ({
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name,
      })),
    });

    return {
      id: first.id,
      gameType: first.game_type,
      title,
      meta,
      isLobby: first.status === "lobby",
    };
  });
}
