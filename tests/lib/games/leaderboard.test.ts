import { describe, expect, it, vi } from "vitest";

// leaderboard.ts imports db at module level; mock it so we can test the pure
// helper without a live database.
vi.mock("@/lib/db", () => ({ db: {} }));

import { rankGroupLeaderboardEntries } from "@/lib/games/leaderboard";

describe("rankGroupLeaderboardEntries", () => {
  it("computes win rate as a rounded percentage of wins over played", () => {
    const result = rankGroupLeaderboardEntries([
      {
        userId: "1",
        username: "a",
        displayName: null,
        avatarUrl: null,
        gamesWon: 3,
        gamesPlayed: 4,
      },
    ]);
    expect(result[0]!.winRate).toBe(75);
  });

  it("sorts by win rate descending", () => {
    const result = rankGroupLeaderboardEntries([
      {
        userId: "1",
        username: "low",
        displayName: null,
        avatarUrl: null,
        gamesWon: 1,
        gamesPlayed: 10,
      },
      {
        userId: "2",
        username: "high",
        displayName: null,
        avatarUrl: null,
        gamesWon: 9,
        gamesPlayed: 10,
      },
      {
        userId: "3",
        username: "mid",
        displayName: null,
        avatarUrl: null,
        gamesWon: 5,
        gamesPlayed: 10,
      },
    ]);
    expect(result.map((entry) => entry.username)).toEqual(["high", "mid", "low"]);
  });

  it("breaks win-rate ties by games played descending (more games = more proven)", () => {
    const result = rankGroupLeaderboardEntries([
      {
        userId: "1",
        username: "fewer",
        displayName: null,
        avatarUrl: null,
        gamesWon: 1,
        gamesPlayed: 2,
      },
      {
        userId: "2",
        username: "more",
        displayName: null,
        avatarUrl: null,
        gamesWon: 5,
        gamesPlayed: 10,
      },
    ]);
    expect(result.map((entry) => entry.username)).toEqual(["more", "fewer"]);
  });

  it("excludes users with zero games played from the ranked list (guards against a NaN win rate)", () => {
    const result = rankGroupLeaderboardEntries([
      {
        userId: "1",
        username: "played",
        displayName: null,
        avatarUrl: null,
        gamesWon: 1,
        gamesPlayed: 2,
      },
      {
        userId: "2",
        username: "never-played",
        displayName: null,
        avatarUrl: null,
        gamesWon: 0,
        gamesPlayed: 0,
      },
    ]);
    expect(result.map((entry) => entry.username)).toEqual(["played"]);
  });

  it("truncates to the requested limit", () => {
    const entries = Array.from({ length: 10 }, (_, index) => ({
      userId: String(index),
      username: `user${String(index)}`,
      displayName: null,
      avatarUrl: null,
      gamesWon: 10 - index,
      gamesPlayed: 10,
    }));
    const result = rankGroupLeaderboardEntries(entries, 5);
    expect(result).toHaveLength(5);
  });

  it("returns an empty array for no entries", () => {
    expect(rankGroupLeaderboardEntries([])).toEqual([]);
  });
});
