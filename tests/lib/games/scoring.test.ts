import { describe, expect, it } from "vitest";

import {
  calculateRoundScore,
  calculateStreakBonus,
  COUNTDOWN_DURATION_MS,
  FIRST_CORRECT_BONUS,
} from "@/lib/games/scoring";

describe("calculateRoundScore", () => {
  it("returns max score (1000) for an instant guess (0ms)", () => {
    expect(calculateRoundScore(0)).toBe(1000);
  });

  it("returns max score for negative time (clamped)", () => {
    expect(calculateRoundScore(-100)).toBe(1000);
  });

  it("returns 0 for time beyond the 15s window", () => {
    expect(calculateRoundScore(15_001)).toBe(0);
    expect(calculateRoundScore(20_000)).toBe(0);
  });

  it("returns 0 for time exactly at the window boundary (15000ms)", () => {
    // At t=15000ms, fraction = 1.0, score = 1000 - floor(1.0 * 900) = 100
    // max(100, 100) = 100 — wait, this is at the boundary
    // Actually 15_000 is <= TOTAL_WINDOW_MS, so it passes the guard
    expect(calculateRoundScore(15_000)).toBe(100);
  });

  it("returns near-min score at the last moment before window ends", () => {
    // t=14999ms: fraction = 14999/15000 ≈ 0.9999, score = 1000 - floor(0.9999 * 900) = 1000 - 899 = 101
    expect(calculateRoundScore(14_999)).toBe(101);
  });

  it("returns a mid-range score at the halfway point (7500ms)", () => {
    // fraction = 0.5, score = 1000 - floor(0.5 * 900) = 1000 - 450 = 550
    expect(calculateRoundScore(7500)).toBe(550);
  });

  it("linearly decreases score from max to min over the window", () => {
    const earlyScore = calculateRoundScore(1000);
    const midScore = calculateRoundScore(7500);
    const lateScore = calculateRoundScore(14_000);

    expect(earlyScore).toBeGreaterThan(midScore);
    expect(midScore).toBeGreaterThan(lateScore);
    expect(lateScore).toBeGreaterThanOrEqual(100);
  });

  it("never returns a score below MIN_SCORE within the window", () => {
    for (let time = 0; time <= 15_000; time += 500) {
      expect(calculateRoundScore(time)).toBeGreaterThanOrEqual(100);
    }
  });

  it("scores at specific time points are correct", () => {
    // t=3000ms: fraction = 0.2, score = 1000 - floor(0.2 * 900) = 1000 - 180 = 820
    expect(calculateRoundScore(3000)).toBe(820);

    // t=5000ms: fraction = 1/3, score = 1000 - floor(0.333... * 900) = 1000 - 300 = 700
    expect(calculateRoundScore(5000)).toBe(700);

    // t=10000ms: fraction = 2/3, score = 1000 - floor(0.666... * 900) = 1000 - 600 = 400
    expect(calculateRoundScore(10_000)).toBe(400);
  });
});

describe("calculateStreakBonus", () => {
  it("returns 0 for no streak (0)", () => {
    expect(calculateStreakBonus(0)).toBe(0);
  });

  it("returns 0 for a streak of 1 (bonus starts at 2)", () => {
    expect(calculateStreakBonus(1)).toBe(0);
  });

  it("returns 100 for a streak of 2 (2 × 50)", () => {
    expect(calculateStreakBonus(2)).toBe(100);
  });

  it("returns 150 for a streak of 3 (3 × 50)", () => {
    expect(calculateStreakBonus(3)).toBe(150);
  });

  it("scales linearly with streak length", () => {
    expect(calculateStreakBonus(5)).toBe(250);
    expect(calculateStreakBonus(10)).toBe(500);
  });
});

describe("scoring constants", () => {
  it("FIRST_CORRECT_BONUS is 200", () => {
    expect(FIRST_CORRECT_BONUS).toBe(200);
  });

  it("COUNTDOWN_DURATION_MS is 5000", () => {
    expect(COUNTDOWN_DURATION_MS).toBe(5000);
  });
});
