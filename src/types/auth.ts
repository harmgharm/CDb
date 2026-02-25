/**
 * Auth-related type definitions
 */

import type { UserRole } from "@/lib/db/types";

/** JWT access token payload */
export interface AccessTokenPayload {
  userId: string;
  role: UserRole;
}

/** JWT refresh token payload */
export interface RefreshTokenPayload {
  userId: string;
  tokenId: string;
  family: string;
}

/** User data safe to expose (no password_hash) */
export interface SafeUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  createdAt: Date;
}
