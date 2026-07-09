/**
 * Server-side session helpers
 *
 * requireAuth/requireAdmin/requireModerator redirect on failure — only safe in
 * server components and pages. In API routes, `redirect()` produces a 307 that
 * `fetch()` follows transparently, so callers like fetchWithAuth never see the
 * 401 they're checking for and the auto-refresh flow silently no-ops. Route
 * handlers should use getAuthUser/getAdminUser/getModeratorUser instead, which
 * return null and let the route respond with a proper errorResponse.
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
 * Server components / pages only — see module note.
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
 * Server components / pages only — see module note.
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
 * Server components / pages only — see module note.
 */
export async function requireModerator(): Promise<User> {
  const user = await requireAuth();
  if (!isModeratorOrAdmin(user.role)) {
    redirect("/home");
  }
  return user;
}

/**
 * Get the current user, or null if not authenticated. API-route-safe
 * counterpart to requireAuth — see module note.
 */
export async function getAuthUser(): Promise<User | null> {
  return getCurrentUser();
}

/**
 * Get the current user if they're an admin, or null otherwise. API-route-safe
 * counterpart to requireAdmin — see module note.
 */
export async function getAdminUser(): Promise<User | null> {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    return null;
  }
  return user;
}

/**
 * Get the current user if they're a moderator or admin, or null otherwise.
 * API-route-safe counterpart to requireModerator — see module note.
 */
export async function getModeratorUser(): Promise<User | null> {
  const user = await getCurrentUser();
  if (!user || !isModeratorOrAdmin(user.role)) {
    return null;
  }
  return user;
}
