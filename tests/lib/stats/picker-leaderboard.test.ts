import { describe, expect, it, vi } from "vitest";

// queries.ts imports db at module level; mock it so we can test the pure merge.
vi.mock("@/lib/db", () => ({ db: {} }));

import { mergeWatchedCounts } from "@/lib/stats/queries";
import type { PickerLeaderboardEntry } from "@/types/detailed-stats";

function entry(overrides: Partial<PickerLeaderboardEntry>): PickerLeaderboardEntry {
  return {
    userId: "u1",
    username: "alex",
    displayName: "Alex",
    avatarUrl: null,
    pickCount: 5,
    avgPickRating: 7.4,
    watchedCount: 0,
    topPicks: [],
    ...overrides,
  };
}

describe("mergeWatchedCounts", () => {
  it("attaches the watched count keyed by user id", () => {
    const entries = [entry({ userId: "u1" }), entry({ userId: "u2" })];
    const counts = new Map([
      ["u1", 47],
      ["u2", 12],
    ]);
    const merged = mergeWatchedCounts(entries, counts);
    expect(merged[0]?.watchedCount).toBe(47);
    expect(merged[1]?.watchedCount).toBe(12);
  });

  it("defaults to zero when a user has no attendance rows", () => {
    const merged = mergeWatchedCounts([entry({ userId: "u1" })], new Map());
    expect(merged[0]?.watchedCount).toBe(0);
  });

  it("coerces string and bigint counts from a Kysely aggregate", () => {
    const merged = mergeWatchedCounts(
      [entry({ userId: "u1" }), entry({ userId: "u2" })],
      new Map<string, string | number | bigint>([
        ["u1", "47"],
        ["u2", 12n],
      ]),
    );
    expect(merged[0]?.watchedCount).toBe(47);
    expect(merged[1]?.watchedCount).toBe(12);
  });

  it("preserves all other entry fields unchanged", () => {
    const original = entry({ userId: "u1", pickCount: 9, avgPickRating: 8.1 });
    const [merged] = mergeWatchedCounts([original], new Map([["u1", 3]]));
    expect(merged).toEqual({ ...original, watchedCount: 3 });
  });
});
