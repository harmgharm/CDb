// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// Mock env before importing tokens (tokens.ts reads env at module level)
vi.mock("@/lib/env", () => ({
  env: {
    JWT_SECRET: "test-jwt-secret-that-is-at-least-32-characters",
    JWT_REFRESH_SECRET: "test-refresh-secret-that-is-at-least-32-chars",
    NODE_ENV: "test",
  },
}));

import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from "@/lib/auth/tokens";

describe("access tokens", () => {
  it("signs and verifies a valid access token", async () => {
    const payload = { userId: "user-123", role: "member" as const };
    const token = await signAccessToken(payload);

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3); // JWT format: header.payload.signature

    const verified = await verifyAccessToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe("user-123");
    expect(verified?.role).toBe("member");
  });

  it("returns null for an invalid access token", async () => {
    const result = await verifyAccessToken("invalid.token.here");
    expect(result).toBeNull();
  });

  it("returns null for an empty string", async () => {
    const result = await verifyAccessToken("");
    expect(result).toBeNull();
  });

  it("preserves admin role in token payload", async () => {
    const payload = { userId: "admin-1", role: "admin" as const };
    const token = await signAccessToken(payload);
    const verified = await verifyAccessToken(token);
    expect(verified?.role).toBe("admin");
  });

  it("cannot verify access token with refresh secret", async () => {
    const payload = { userId: "user-1", role: "member" as const };
    const token = await signAccessToken(payload);
    // Access tokens should not verify as refresh tokens
    const result = await verifyRefreshToken(token);
    expect(result).toBeNull();
  });
});

describe("refresh tokens", () => {
  it("signs and verifies a valid refresh token", async () => {
    const payload = {
      userId: "user-123",
      tokenId: "token-abc",
      family: "family-xyz",
    };
    const token = await signRefreshToken(payload);

    expect(typeof token).toBe("string");

    const verified = await verifyRefreshToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe("user-123");
    expect(verified?.tokenId).toBe("token-abc");
    expect(verified?.family).toBe("family-xyz");
  });

  it("returns null for an invalid refresh token", async () => {
    const result = await verifyRefreshToken("garbage");
    expect(result).toBeNull();
  });

  it("cannot verify refresh token with access secret", async () => {
    const payload = {
      userId: "user-1",
      tokenId: "tid",
      family: "fam",
    };
    const token = await signRefreshToken(payload);
    // Refresh tokens should not verify as access tokens
    const result = await verifyAccessToken(token);
    expect(result).toBeNull();
  });
});
