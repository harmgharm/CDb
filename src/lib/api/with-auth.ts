/**
 * Auth-guard wrappers for API route handlers.
 *
 * Replaces the repeated `const user = await getAuthUser(); if (!user) return
 * errorResponse(...)` boilerplate. Each wrapper resolves the user once and
 * injects it into the handler — routes that only need the guard (not the user
 * value) can simply not use the parameter.
 */

import type { NextRequest, NextResponse } from "next/server";

import { getAdminUser, getAuthUser, getModeratorUser } from "@/lib/auth";
import type { User } from "@/lib/db/types";

import { errorResponse } from "./response";

export interface RouteContext<P = Record<string, never>> {
  params: Promise<P>;
}

type AuthedHandler<P> = (
  req: NextRequest,
  user: User,
  context: RouteContext<P>,
) => Promise<NextResponse>;

function createAuthWrapper<P>(
  resolveUser: () => Promise<User | null>,
  message: string,
  status: number,
) {
  return (handler: AuthedHandler<P>) =>
    async (req: NextRequest, context: RouteContext<P>): Promise<NextResponse> => {
      const user = await resolveUser();
      if (!user) {
        return errorResponse(message, status);
      }
      return handler(req, user, context);
    };
}

/** Requires a logged-in user. 401 + "Not authenticated" if absent. */
export function withAuth<P = Record<string, never>>(handler: AuthedHandler<P>) {
  return createAuthWrapper<P>(getAuthUser, "Not authenticated", 401)(handler);
}

/** Requires an admin user. 403 + "Not authorized" otherwise. */
export function withAdmin<P = Record<string, never>>(handler: AuthedHandler<P>) {
  return createAuthWrapper<P>(getAdminUser, "Not authorized", 403)(handler);
}

/** Requires a moderator or admin user. 403 + "Not authorized" otherwise. */
export function withModerator<P = Record<string, never>>(handler: AuthedHandler<P>) {
  return createAuthWrapper<P>(getModeratorUser, "Not authorized", 403)(handler);
}
