/**
 * POST /api/auth/signup
 *
 * Invite-only user registration.
 */

import type { NextRequest } from "next/server";

import { getIp } from "@/lib/api/get-ip";
import { errorResponse, successResponse } from "@/lib/api/response";
import {
  createRefreshToken,
  hashPassword,
  setAuthCookies,
  signAccessToken,
  signupLimiter,
  validateInviteCode,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { withTransaction } from "@/lib/db/transaction";
import { registerSchema } from "@/lib/validations/auth";
import type { SafeUser } from "@/types/auth";

export async function POST(req: NextRequest) {
  // Rate limit
  const ip = getIp(req);
  const limit = signupLimiter.check(ip);
  if (!limit.allowed) {
    return errorResponse(`Too many attempts. Try again in ${String(limit.retryAfter)}s.`, 429);
  }

  // Parse & validate
  const body: unknown = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { email, username, password, displayName, inviteCode } = parsed.data;

  // Validate invite code
  const invite = await validateInviteCode(inviteCode);
  if (!invite) {
    return errorResponse("Invalid or expired invite code", 400);
  }

  // Check uniqueness
  const existingUser = await db
    .selectFrom("users")
    .select("id")
    .where((eb) => eb.or([eb("email", "=", email), eb("username", "=", username)]))
    .executeTakeFirst();

  if (existingUser) {
    return errorResponse("Email or username already taken", 409);
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Transaction: create user + mark invite used + create refresh token + audit
  const result = await withTransaction(async (trx) => {
    const user = await trx
      .insertInto("users")
      .values({
        email,
        username,
        password_hash: passwordHash,
        display_name: displayName ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    await trx
      .updateTable("invite_codes")
      .set({ used_by_user_id: user.id })
      .where("code", "=", inviteCode)
      .execute();

    await trx
      .insertInto("audit_log")
      .values({
        user_id: user.id,
        action: "user.created",
        entity_type: "user",
        entity_id: user.id,
        metadata: JSON.stringify({ invite_code: inviteCode }),
      })
      .execute();

    await trx
      .insertInto("audit_log")
      .values({
        user_id: user.id,
        action: "invite.used",
        entity_type: "invite_code",
        entity_id: invite.id,
      })
      .execute();

    return user;
  });

  // Create tokens (outside transaction — refresh token stored separately)
  const accessToken = await signAccessToken({ userId: result.id, role: result.role });
  const { jwt: refreshJwt } = await createRefreshToken(result.id);

  // Build response with cookies
  const safeUser: SafeUser = {
    id: result.id,
    username: result.username,
    email: result.email,
    displayName: result.display_name,
    avatarUrl: result.avatar_url,
    role: result.role,
    createdAt: result.created_at,
  };

  const response = successResponse(safeUser, "Account created", 201);
  setAuthCookies(response.cookies, accessToken, refreshJwt);

  return response;
}
