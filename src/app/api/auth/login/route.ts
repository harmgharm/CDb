/**
 * POST /api/auth/login
 *
 * Authenticate with email or username + password.
 */

import type { NextRequest } from "next/server";

import { getIp } from "@/lib/api/get-ip";
import { errorResponse, successResponse } from "@/lib/api/response";
import {
  createRefreshToken,
  logAudit,
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

  const { identifier, password } = parsed.data;

  // Find user by email or username
  const user = await db
    .selectFrom("users")
    .selectAll()
    .where((eb) => eb.or([eb("email", "=", identifier), eb("username", "=", identifier)]))
    .executeTakeFirst();

  if (!user) {
    return errorResponse("Invalid credentials", 401);
  }

  // Verify password
  const valid = await verifyPassword(user.password_hash, password);
  if (!valid) {
    void logAudit({
      userId: user.id,
      action: "user.login_failed",
      entityType: "user",
      entityId: user.id,
      metadata: { ip, identifier },
    });
    return errorResponse("Invalid credentials", 401);
  }

  // Clear rate limit on successful login
  loginLimiter.reset(ip);

  void logAudit({
    userId: user.id,
    action: "user.login_succeeded",
    entityType: "user",
    entityId: user.id,
    metadata: { ip, identifier, userAgent: req.headers.get("user-agent") ?? "unknown" },
  });

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
