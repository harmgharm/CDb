/**
 * Invite code helpers
 */

import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import type { InviteCode } from "@/lib/db/types";

/**
 * Validate an invite code — must exist, not used, not expired.
 */
export async function validateInviteCode(code: string): Promise<InviteCode | null> {
  const invite = await db
    .selectFrom("invite_codes")
    .selectAll()
    .where("code", "=", code)
    .where("used_by_user_id", "is", null)
    .where("expires_at", ">", new Date())
    .executeTakeFirst();

  return invite ?? null;
}

/**
 * Mark an invite code as used by a specific user.
 */
export async function markInviteCodeUsed(code: string, userId: string): Promise<void> {
  await db
    .updateTable("invite_codes")
    .set({ used_by_user_id: userId })
    .where("code", "=", code)
    .execute();
}

interface GeneratedInviteCode {
  id: string;
  code: string;
  expiresAt: Date;
}

/**
 * Generate a new invite code.
 * Returns the id, code string, and expiry date.
 */
export async function generateInviteCode(
  createdByUserId: string,
  expiresInDays = 30,
): Promise<GeneratedInviteCode> {
  const code = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const record = await db
    .insertInto("invite_codes")
    .values({
      code,
      created_by_user_id: createdByUserId,
      expires_at: expiresAt,
    })
    .returning(["id", "code", "expires_at"])
    .executeTakeFirstOrThrow();

  return { id: record.id, code: record.code, expiresAt: record.expires_at };
}
