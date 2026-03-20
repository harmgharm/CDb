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

import { hashToken } from "@/lib/auth/refresh-tokens";

describe("hashToken", () => {
  it("returns a hex string", () => {
    const hash = hashToken("some-jwt-token");
    expect(hash).toMatch(/^[\da-f]{64}$/); // SHA-256 = 64 hex chars
  });

  it("is deterministic (same input = same output)", () => {
    const hash1 = hashToken("my-token");
    const hash2 = hashToken("my-token");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", () => {
    const hash1 = hashToken("token-a");
    const hash2 = hashToken("token-b");
    expect(hash1).not.toBe(hash2);
  });
});
