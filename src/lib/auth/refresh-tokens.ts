/**
 * Refresh token database operations
 */

import { createHash, randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import type { RefreshToken } from "@/lib/db/types";

import { signRefreshToken } from "./tokens";

const REFRESH_TOKEN_DAYS = 7;

/**
 * Grace window (ms) during which re-presenting a just-rotated refresh token is
 * treated as a benign concurrent-refresh race rather than theft. A request sent
 * before the new cookie committed (or a refresh firing just after the prior one
 * resolved) lands here instead of triggering a family-wide revocation — the
 * source of the cascading 401s / Ably 80017 errors. 30s mirrors Okta's default.
 */
export const REUSE_GRACE_MS = 30 * 1000;

/**
 * Whether a re-presented revoked token is still inside the reuse grace window.
 * Pure (now is injected) so the security boundary is unit-testable. A null
 * `revokedAt` means the token isn't revoked — never within grace (no race to
 * forgive); the caller shouldn't be asking, but it's safe-by-default false.
 */
export function isWithinReuseGrace(revokedAt: Date | null, now: number): boolean {
  if (revokedAt === null) return false;
  return now - revokedAt.getTime() <= REUSE_GRACE_MS;
}

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

/**
 * Revoke a token as part of rotation, recording its successor in `replaced_by`.
 * The link lets a racing request that re-presents this (now-revoked) token
 * follow the chain to the family's current valid token during the grace window,
 * instead of the reuse triggering a family-wide revocation.
 */
export async function revokeAndReplaceRefreshToken(
  tokenId: string,
  replacedBy: string,
): Promise<void> {
  await db
    .updateTable("refresh_tokens")
    .set({ revoked_at: new Date(), replaced_by: replacedBy })
    .where("id", "=", tokenId)
    .execute();
}

/**
 * Follow the `replaced_by` chain from a revoked token to the family's current
 * token. Returns the latest token only if it's both unrevoked and unexpired;
 * undefined if the chain dead-ends, the end token was revoked (family torn
 * down), or it has expired. Bounded iteration guards against an unexpected cycle.
 */
export async function resolveCurrentToken(start: RefreshToken): Promise<RefreshToken | undefined> {
  let current: RefreshToken | undefined = start;
  for (let hops = 0; hops < 20 && current?.replaced_by != null; hops++) {
    current = await db
      .selectFrom("refresh_tokens")
      .selectAll()
      .where("id", "=", current.replaced_by)
      .executeTakeFirst();
  }
  // Dead-end (chain pointed at a missing row), the end token is itself revoked
  // (family torn down), or it's expired → no current token to hand back. The
  // expiry check mirrors the normal rotation path so the grace path never mints
  // an access token off an expired DB row even if the row's expiry ever diverges
  // from the presented JWT's claim.
  if (current === undefined) return undefined;
  if (current.revoked_at !== null) return undefined;
  if (current.expires_at < new Date()) return undefined;
  return current;
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
