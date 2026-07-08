/**
 * Migration 0032: game_sessions abandoned status
 *
 * `game_sessions` had no way to distinguish a real completion from a session
 * nobody ever finished — lobbies never started, active games everyone walked
 * away from. Both silently sat in `lobby`/`active` forever (confirmed on the
 * dev DB: 59% of all sessions were stuck this way) because the only status
 * values were 'lobby' | 'active' | 'finished' and nothing ever transitioned a
 * dead session out of the first two. Adding 'abandoned' as its own terminal
 * status — not reusing 'finished' — keeps every existing `status = 'finished'`
 * query (leaderboard, stats) correctly meaning "a real completed game" with no
 * extra filtering.
 */

import type { Kysely } from "kysely";
import { sql } from "kysely";

export async function up(db: Kysely<never>): Promise<void> {
  await sql`
    ALTER TABLE game_sessions
    DROP CONSTRAINT game_sessions_status_check
  `.execute(db);

  await sql`
    ALTER TABLE game_sessions
    ADD CONSTRAINT game_sessions_status_check
    CHECK (status IN ('lobby', 'active', 'finished', 'abandoned'))
  `.execute(db);
}

export async function down(db: Kysely<never>): Promise<void> {
  await sql`
    ALTER TABLE game_sessions
    DROP CONSTRAINT game_sessions_status_check
  `.execute(db);

  await sql`
    ALTER TABLE game_sessions
    ADD CONSTRAINT game_sessions_status_check
    CHECK (status IN ('lobby', 'active', 'finished'))
  `.execute(db);
}
