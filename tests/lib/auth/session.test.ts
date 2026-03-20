import { describe, expect, it, vi } from "vitest";

// Mock dependencies that session.ts imports at module level
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({
  env: {
    JWT_SECRET: "test-jwt-secret-that-is-at-least-32-characters",
    JWT_REFRESH_SECRET: "test-refresh-secret-that-is-at-least-32-chars",
    NODE_ENV: "test",
  },
}));

import { isModeratorOrAdmin } from "@/lib/auth/session";

describe("isModeratorOrAdmin", () => {
  it("returns true for admin", () => {
    expect(isModeratorOrAdmin("admin")).toBe(true);
  });

  it("returns true for moderator", () => {
    expect(isModeratorOrAdmin("moderator")).toBe(true);
  });

  it("returns false for member", () => {
    expect(isModeratorOrAdmin("member")).toBe(false);
  });
});
