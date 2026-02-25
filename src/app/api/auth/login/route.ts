/**
 * POST /api/auth/login
 *
 * Authenticate with email + password.
 */

import type { NextRequest } from "next/server";

import { getIp } from "@/lib/api/get-ip";
import { errorResponse, successResponse } from "@/lib/api/response";
import {
  createRefreshToken,
  loginLimiter,
  setAuthCookies,
  signAccessToken,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations/auth";
import type { SafeUser } from "@/types/auth";

export async function POST(req: NextRequest) {
  // Rate limit
  const ip = getIp(req);
  const limit = loginLimiter.check(ip);
  if (!limit.allowed) {
    return errorResponse(`Too many attempts. Try again in ${String(limit.retryAfter)}s.`, 429);
  }

  // Parse & validate
  const body: unknown = await req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("Invalid input", 400);
  }

  const { email, password } = parsed.data;

  // Find user
  const user = await db
    .selectFrom("users")
    .selectAll()
    .where("email", "=", email)
    .executeTakeFirst();

  if (!user) {
    return errorResponse("Invalid email or password", 401);
  }

  // Verify password
  const valid = await verifyPassword(user.password_hash, password);
  if (!valid) {
    return errorResponse("Invalid email or password", 401);
  }

  // Create tokens
  const accessToken = await signAccessToken({ userId: user.id, role: user.role });
  const { jwt: refreshJwt } = await createRefreshToken(user.id);

  const safeUser: SafeUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    role: user.role,
    createdAt: user.created_at,
  };

  const response = successResponse(safeUser);
  setAuthCookies(response.cookies, accessToken, refreshJwt);

  return response;
}
