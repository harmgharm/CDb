/**
 * JWT token utilities using jose (Edge Runtime compatible)
 */

import { jwtVerify, SignJWT } from "jose";

import { env } from "@/lib/env";
import type { AccessTokenPayload, RefreshTokenPayload } from "@/types/auth";

const ACCESS_SECRET = new TextEncoder().encode(env.JWT_SECRET);
const REFRESH_SECRET = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

const ISSUER = "cdb";
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(ACCESS_SECRET);
}

export async function signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(REFRESH_SECRET);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET, { issuer: ISSUER });
    return payload as unknown as AccessTokenPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET, { issuer: ISSUER });
    return payload as unknown as RefreshTokenPayload;
  } catch {
    return null;
  }
}
