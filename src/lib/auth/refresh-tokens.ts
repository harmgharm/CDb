/**
 * Refresh token database operations
 */

import { createHash, randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import type { RefreshToken } from "@/lib/db/types";

import { signRefreshToken } from "./tokens";

const REFRESH_TOKEN_DAYS = 7;

/** Hash a refresh token JWT for storage (SHA-256) */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a new refresh token for a user.
 * Returns the signed JWT (not the hash).
 */
export async function createRefreshToken(
  userId: string,
  family?: string,
): Promise<{ jwt: string; tokenId: string }> {
  const tokenId = randomUUID();
  const tokenFamily = family ?? randomUUID();

  const jwt = await signRefreshToken({ userId, tokenId, family: tokenFamily });

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_DAYS);

  await db
    .insertInto("refresh_tokens")
    .values({
      id: tokenId,
      user_id: userId,
      token_hash: hashToken(jwt),
      family: tokenFamily,
      expires_at: expiresAt,
    })
    .execute();

  return { jwt, tokenId };
}

/** Find a refresh token by its hash */
export async function findRefreshToken(tokenHash: string): Promise<RefreshToken | undefined> {
  return db
    .selectFrom("refresh_tokens")
    .selectAll()
    .where("token_hash", "=", tokenHash)
    .executeTakeFirst();
}

/** Revoke a single refresh token */
export async function revokeRefreshToken(tokenId: string): Promise<void> {
  await db
    .updateTable("refresh_tokens")
    .set({ revoked_at: new Date() })
    .where("id", "=", tokenId)
    .execute();
}

/** Revoke all tokens in a family (reuse detection) */
export async function revokeTokenFamily(family: string): Promise<void> {
  await db
    .updateTable("refresh_tokens")
    .set({ revoked_at: new Date() })
    .where("family", "=", family)
    .where("revoked_at", "is", null)
    .execute();
}

/** Revoke all refresh tokens for a user (logout everywhere) */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await db
    .updateTable("refresh_tokens")
    .set({ revoked_at: new Date() })
    .where("user_id", "=", userId)
    .where("revoked_at", "is", null)
    .execute();
}
