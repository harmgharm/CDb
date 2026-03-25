import { describe, expect, it } from "vitest";

import { createGameSchema, submitGuessSchema } from "@/lib/validations/games";

describe("createGameSchema", () => {
  it("accepts valid game creation", () => {
    const result = createGameSchema.safeParse({ difficulty: "normal" });
    expect(result.success).toBe(true);
  });

  it("provides defaults for gameType, mode, and roundCount", () => {
    const result = createGameSchema.safeParse({ difficulty: "hard" });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.gameType).toBe("poster_reveal");
    expect(result.data.mode).toBe("solo");
    expect(result.data.roundCount).toBe(5);
  });

  it("accepts all valid game types", () => {
    for (const gameType of ["poster_reveal", "rating_guess", "year_guess"]) {
      const result = createGameSchema.safeParse({ gameType, difficulty: "normal" });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid difficulty", () => {
    const result = createGameSchema.safeParse({ difficulty: "easy" });
    expect(result.success).toBe(false);
  });

  it("rejects roundCount over 20", () => {
    const result = createGameSchema.safeParse({ difficulty: "normal", roundCount: 21 });
    expect(result.success).toBe(false);
  });

  it("rejects roundCount under 1", () => {
    const result = createGameSchema.safeParse({ difficulty: "normal", roundCount: 0 });
    expect(result.success).toBe(false);
  });

  it("coerces string roundCount", () => {
    const result = createGameSchema.safeParse({ difficulty: "normal", roundCount: "10" });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.roundCount).toBe(10);
  });
});

describe("submitGuessSchema", () => {
  const validGuess = {
    roundId: "550e8400-e29b-41d4-a716-446655440000",
    timeFromStartMs: 5000,
  };

  it("accepts valid guess with text", () => {
    const result = submitGuessSchema.safeParse({
      ...validGuess,
      guessText: "Inception",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid guess with mediaId", () => {
    const result = submitGuessSchema.safeParse({
      ...validGuess,
      mediaId: "550e8400-e29b-41d4-a716-446655440001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative timeFromStartMs", () => {
    const result = submitGuessSchema.safeParse({ ...validGuess, timeFromStartMs: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects timeFromStartMs over 60 seconds", () => {
    const result = submitGuessSchema.safeParse({ ...validGuess, timeFromStartMs: 60_001 });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 0ms", () => {
    const result = submitGuessSchema.safeParse({ ...validGuess, timeFromStartMs: 0 });
    expect(result.success).toBe(true);
  });

  it("accepts exactly 60000ms", () => {
    const result = submitGuessSchema.safeParse({ ...validGuess, timeFromStartMs: 60_000 });
    expect(result.success).toBe(true);
  });

  it("rejects invalid roundId UUID", () => {
    const result = submitGuessSchema.safeParse({ ...validGuess, roundId: "not-uuid" });
    expect(result.success).toBe(false);
  });
});
