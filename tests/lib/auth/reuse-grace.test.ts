import { describe, expect, it, vi } from "vitest";

// Mock env and db (refresh-tokens.ts imports tokens.ts which imports env, and also imports db)
vi.mock("@/lib/env", () => ({
  env: {
    JWT_SECRET: "test-jwt-secret-that-is-at-least-32-characters",
    JWT_REFRESH_SECRET: "test-refresh-secret-that-is-at-least-32-chars",
    NODE_ENV: "test",
  },
}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { isWithinReuseGrace, REUSE_GRACE_MS } from "@/lib/auth/refresh-tokens";

describe("isWithinReuseGrace", () => {
  const now = 1_700_000_000_000; // fixed "now" so cases are deterministic

  it("returns false for a non-revoked token (no race to forgive)", () => {
    expect(isWithinReuseGrace(null, now)).toBe(false);
  });

  it("forgives reuse just after revocation (benign concurrent-refresh race)", () => {
    const revokedAt = new Date(now - 1000); // 1s ago
    expect(isWithinReuseGrace(revokedAt, now)).toBe(true);
  });

  it("forgives reuse exactly at the window boundary (inclusive)", () => {
    const revokedAt = new Date(now - REUSE_GRACE_MS); // exactly the window
    expect(isWithinReuseGrace(revokedAt, now)).toBe(true);
  });

  it("treats reuse one ms past the window as theft", () => {
    const revokedAt = new Date(now - REUSE_GRACE_MS - 1);
    expect(isWithinReuseGrace(revokedAt, now)).toBe(false);
  });

  it("treats stale reuse (well outside the window) as theft", () => {
    const revokedAt = new Date(now - 60 * 60 * 1000); // an hour ago
    expect(isWithinReuseGrace(revokedAt, now)).toBe(false);
  });

  it("handles a revocation timestamp in the (clock-skew) future as within grace", () => {
    // A revoked_at slightly ahead of `now` yields a negative delta, which is
    // <= the window — correctly still forgiven rather than mis-flagged as theft.
    const revokedAt = new Date(now + 500);
    expect(isWithinReuseGrace(revokedAt, now)).toBe(true);
  });
});
