/**
 * Server-side session helpers
 *
 * Use in server components and API routes to get the current user.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import type { User, UserRole } from "@/lib/db/types";

import { getAccessToken } from "./cookies";
import { verifyAccessToken } from "./tokens";

/**
 * Get the currently authenticated user, or null if not authenticated.
 * Reads the access token from cookies, verifies it, and fetches the user from DB.
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = getAccessToken(cookieStore);

  if (token === undefined) {
    return null;
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    return null;
  }

  const user = await db
    .selectFrom("users")
    .selectAll()
    .where("id", "=", payload.userId)
    .executeTakeFirst();

  return user ?? null;
}

/**
 * Require authentication. Redirects to /login if not authenticated.
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Check if a role has moderator-level (or higher) permissions.
 * Moderators have the same content-moderation powers as admins.
 */
export function isModeratorOrAdmin(role: UserRole): boolean {
  return role === "admin" || role === "moderator";
}

/**
 * Require admin role. Redirects to /home if not admin.
 */
export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();
  if (user.role !== "admin") {
    redirect("/home");
  }
  return user;
}

/**
 * Require moderator or admin role. Redirects to /home if insufficient permissions.
 */
export async function requireModerator(): Promise<User> {
  const user = await requireAuth();
  if (!isModeratorOrAdmin(user.role)) {
    redirect("/home");
  }
  return user;
}
