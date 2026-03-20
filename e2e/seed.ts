/**
 * E2E Database Seeding
 *
 * Creates and cleans up test data in the test database.
 * Uses a standalone Kysely connection (not the app's db client)
 * to avoid loading the full env validation.
 */

import { neonConfig, Pool } from "@neondatabase/serverless";
import argon2 from "argon2";
import { Kysely, PostgresDialect } from "kysely";
import ws from "ws";

import { E2E_ADMIN, E2E_INVITE_CODE, E2E_MEMBER, E2E_SIGNUP, SHAWSHANK_TMDB_ID } from "./constants";

neonConfig.webSocketConstructor = ws;

function createDb(): Kysely<Record<string, Record<string, unknown>>> {
  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error("DATABASE_URL not set — is .env.test configured?");
  }
  const pool = new Pool({ connectionString });
  return new Kysely({ dialect: new PostgresDialect({ pool }) });
}

const TEST_USER_IDS = [E2E_ADMIN.id, E2E_MEMBER.id];

/**
 * Remove all test data. Safe to call even if data doesn't exist.
 * Deletes in reverse dependency order to respect foreign keys.
 */
export async function cleanup(): Promise<void> {
  const db = createDb();

  try {
    // Find signup test user (if exists) and add to cleanup
    const signupUser = await db
      .selectFrom("users")
      .select("id")
      .where("username", "=", E2E_SIGNUP.username)
      .executeTakeFirst();

    const userIds = signupUser ? [...TEST_USER_IDS, signupUser.id as string] : TEST_USER_IDS;

    // Delete in dependency order
    await db.deleteFrom("game_guesses").where("user_id", "in", userIds).execute();
    await db.deleteFrom("game_players").where("user_id", "in", userIds).execute();
    await db.deleteFrom("game_leaderboard").where("user_id", "in", userIds).execute();
    await db.deleteFrom("notification_preferences").where("user_id", "in", userIds).execute();
    await db.deleteFrom("notifications").where("user_id", "in", userIds).execute();
    await db.deleteFrom("recommendation_dismissals").where("user_id", "in", userIds).execute();
    await db.deleteFrom("recommendation_cache").where("user_id", "in", userIds).execute();
    await db.deleteFrom("watchlist").where("user_id", "in", userIds).execute();
    await db.deleteFrom("ratings").where("user_id", "in", userIds).execute();
    await db.deleteFrom("session_attendees").where("user_id", "in", userIds).execute();

    // Delete sessions created by test users
    await db.deleteFrom("watch_sessions").where("created_by_user_id", "in", userIds).execute();

    // Delete media imported during tests (by known TMDB ID)
    await db.deleteFrom("media").where("tmdb_id", "=", SHAWSHANK_TMDB_ID).execute();

    await db.deleteFrom("audit_log").where("user_id", "in", userIds).execute();
    await db.deleteFrom("refresh_tokens").where("user_id", "in", userIds).execute();
    await db.deleteFrom("invite_codes").where("id", "=", E2E_INVITE_CODE.id).execute();
    // Also clean invite codes created by test users
    await db.deleteFrom("invite_codes").where("created_by_user_id", "in", userIds).execute();
    await db.deleteFrom("users").where("id", "in", userIds).execute();

    // Delete signup test user by username
    if (signupUser) {
      await db
        .deleteFrom("users")
        .where("id", "=", signupUser.id as string)
        .execute();
    }
  } finally {
    await db.destroy();
  }
}

/**
 * Seed the test database with known test data.
 */
export async function seed(): Promise<void> {
  const db = createDb();

  try {
    const adminHash = await argon2.hash(E2E_ADMIN.password, { type: argon2.argon2id });
    const memberHash = await argon2.hash(E2E_MEMBER.password, { type: argon2.argon2id });

    // Create admin user
    await db
      .insertInto("users")
      .values({
        id: E2E_ADMIN.id,
        username: E2E_ADMIN.username,
        email: E2E_ADMIN.email,
        password_hash: adminHash,
        display_name: E2E_ADMIN.displayName,
        role: "admin",
      })
      .execute();

    // Create member user
    await db
      .insertInto("users")
      .values({
        id: E2E_MEMBER.id,
        username: E2E_MEMBER.username,
        email: E2E_MEMBER.email,
        password_hash: memberHash,
        display_name: E2E_MEMBER.displayName,
        role: "member",
      })
      .execute();

    // Create invite code for signup test
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await db
      .insertInto("invite_codes")
      .values({
        id: E2E_INVITE_CODE.id,
        code: E2E_INVITE_CODE.code,
        created_by_user_id: E2E_ADMIN.id,
        expires_at: expiresAt,
      })
      .execute();
  } finally {
    await db.destroy();
  }
}
