import { describe, expect, it } from "vitest";

import { pearsonCorrelation } from "@/lib/recommendations/math";

describe("pearsonCorrelation", () => {
  it("returns 1 for perfectly correlated vectors", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [2, 4, 6, 8, 10];
    const result = pearsonCorrelation(a, b);
    expect(result).toBeCloseTo(1, 5);
  });

  it("returns -1 for perfectly inversely correlated vectors", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [10, 8, 6, 4, 2];
    const result = pearsonCorrelation(a, b);
    expect(result).toBeCloseTo(-1, 5);
  });

  it("returns 0 for uncorrelated vectors", () => {
    // Constant vectors have zero standard deviation → 0 correlation
    const a = [5, 5, 5, 5, 5];
    const b = [1, 2, 3, 4, 5];
    const result = pearsonCorrelation(a, b);
    expect(result).toBe(0);
  });

  it("returns 0 for identical constant vectors", () => {
    const a = [7, 7, 7];
    const b = [7, 7, 7];
    const result = pearsonCorrelation(a, b);
    expect(result).toBe(0);
  });

  it("returns 0 for vectors with fewer than 3 items", () => {
    const a = [8, 9];
    const b = [7, 10];
    const result = pearsonCorrelation(a, b);
    expect(result).toBe(0);
  });

  it("returns 0 for empty vectors", () => {
    expect(pearsonCorrelation([], [])).toBe(0);
  });

  it("handles realistic movie rating data", () => {
    // User A and B both rate 5 movies — similar tastes
    const userA = [8, 7, 9, 6, 8];
    const userB = [9, 7, 10, 5, 7];
    const result = pearsonCorrelation(userA, userB);
    // Should be positively correlated
    expect(result).toBeGreaterThan(0.5);
    expect(result).toBeLessThanOrEqual(1);
  });

  it("computes moderate correlation correctly", () => {
    // Mixed agreement
    const a = [10, 3, 7, 5, 9];
    const b = [8, 5, 6, 7, 8];
    const result = pearsonCorrelation(a, b);
    // Should be moderately positive
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it("handles exactly 3 items (minimum threshold)", () => {
    const a = [5, 8, 3];
    const b = [6, 9, 2];
    const result = pearsonCorrelation(a, b);
    expect(result).toBeGreaterThan(0.9); // Strong positive correlation
  });
});
