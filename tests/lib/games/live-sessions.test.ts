import { describe, expect, it, vi } from "vitest";

// live-sessions.ts imports db at module level; mock it so we can test the
// pure formatter without a live database.
vi.mock("@/lib/db", () => ({ db: {} }));

import { formatLiveSession } from "@/lib/games/live-sessions";

describe("formatLiveSession", () => {
  it("labels a lobby session with the joined-player count, not round progress", () => {
    const result = formatLiveSession({
      id: "game-1",
      gameDisplayName: "Year Guesser",
      status: "lobby",
      currentRound: 0,
      roundCount: 5,
      players: [
        { userId: "u1", username: "harm", displayName: null },
        { userId: "u2", username: "tose", displayName: "Tose" },
      ],
    });

    expect(result.title).toBe("Year Guesser · Lobby");
    expect(result.meta).toBe("2 joined");
  });

  it("labels an active session with 1-indexed round progress, not the raw 0-indexed currentRound", () => {
    const result = formatLiveSession({
      id: "game-1",
      gameDisplayName: "Poster Reveal",
      status: "active",
      currentRound: 3,
      roundCount: 5,
      players: [
        { userId: "u1", username: "harm", displayName: "Harm" },
        { userId: "u2", username: "tose", displayName: null },
        { userId: "u3", username: "ant", displayName: null },
      ],
    });

    expect(result.title).toBe("Poster Reveal · Round 4 of 5");
    expect(result.meta).toBe("Harm, tose, ant");
  });

  it("falls back to the username when a player has no display name", () => {
    const result = formatLiveSession({
      id: "game-1",
      gameDisplayName: "Rating Guesser",
      status: "active",
      currentRound: 0,
      roundCount: 5,
      players: [{ userId: "u1", username: "grewy", displayName: null }],
    });

    expect(result.meta).toBe("grewy");
  });
});
