import { describe, expect, it, vi } from "vitest";

// cleanup.ts imports db at module level; mock it so we can test the pure
// threshold logic without a live database.
vi.mock("@/lib/db", () => ({ db: {} }));

import { isSessionAbandoned } from "@/lib/games/cleanup";

describe("isSessionAbandoned", () => {
  const now = new Date("2026-07-08T12:00:00.000Z");

  it("does not abandon a lobby session created less than 45 minutes ago", () => {
    const result = isSessionAbandoned(
      {
        status: "lobby",
        createdAt: new Date("2026-07-08T11:30:00.000Z"),
        lastActivityAt: null,
      },
      now,
    );

    expect(result).toBe(false);
  });

  it("abandons a lobby session that has sat for more than 45 minutes", () => {
    const result = isSessionAbandoned(
      {
        status: "lobby",
        createdAt: new Date("2026-07-08T11:00:00.000Z"),
        lastActivityAt: null,
      },
      now,
    );

    expect(result).toBe(true);
  });

  it("does not abandon an active session with recent round/guess activity, even if created long ago", () => {
    const result = isSessionAbandoned(
      {
        status: "active",
        createdAt: new Date("2026-07-08T08:00:00.000Z"),
        lastActivityAt: new Date("2026-07-08T11:00:00.000Z"),
      },
      now,
    );

    expect(result).toBe(false);
  });

  it("abandons an active session whose last activity is more than 2.5 hours old", () => {
    const result = isSessionAbandoned(
      {
        status: "active",
        createdAt: new Date("2026-07-08T08:00:00.000Z"),
        lastActivityAt: new Date("2026-07-08T09:00:00.000Z"),
      },
      now,
    );

    expect(result).toBe(true);
  });

  it("falls back to created_at for an active session with no round/guess activity yet", () => {
    const result = isSessionAbandoned(
      {
        status: "active",
        createdAt: new Date("2026-07-08T09:00:00.000Z"),
        lastActivityAt: null,
      },
      now,
    );

    expect(result).toBe(true);
  });

  it("never abandons a finished or already-abandoned session", () => {
    expect(
      isSessionAbandoned(
        {
          status: "finished",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          lastActivityAt: null,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isSessionAbandoned(
        {
          status: "abandoned",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          lastActivityAt: null,
        },
        now,
      ),
    ).toBe(false);
  });
});
