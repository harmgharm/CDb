import { describe, expect, it, vi } from "vitest";

// Mock transitive dependencies (predict.ts → signals.ts → db, and db → env)
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({
  env: { NODE_ENV: "test" },
}));

import { computeConfidence, computeVerdict } from "@/lib/predictions/predict";

describe("computeConfidence", () => {
  it("returns 'high' when 4+ signals and 10+ ratings", () => {
    expect(computeConfidence(4, 10)).toBe("high");
    expect(computeConfidence(6, 20)).toBe("high");
    expect(computeConfidence(4, 100)).toBe("high");
  });

  it("returns 'medium' when both conditions partially met", () => {
    // 4 signals but only 5 ratings
    expect(computeConfidence(4, 5)).toBe("medium");
    // 2 signals but only 3 ratings
    expect(computeConfidence(2, 3)).toBe("medium");
  });

  it("returns 'medium' when only signal count qualifies", () => {
    expect(computeConfidence(2, 0)).toBe("medium");
    expect(computeConfidence(3, 1)).toBe("medium");
  });

  it("returns 'medium' when only rating count qualifies", () => {
    expect(computeConfidence(1, 5)).toBe("medium");
    expect(computeConfidence(0, 10)).toBe("medium");
  });

  it("returns 'low' when neither condition met", () => {
    expect(computeConfidence(0, 0)).toBe("low");
    expect(computeConfidence(1, 4)).toBe("low");
    expect(computeConfidence(1, 0)).toBe("low");
  });

  it("requires BOTH conditions for 'high' (not just one)", () => {
    // 4 signals but only 9 ratings — medium, not high
    expect(computeConfidence(4, 9)).toBe("medium");
    // 3 signals but 10 ratings — medium, not high
    expect(computeConfidence(3, 10)).toBe("medium");
  });
});

describe("computeVerdict", () => {
  it("returns 'Highly recommended' for scores >= 8", () => {
    expect(computeVerdict(8)).toBe("Highly recommended");
    expect(computeVerdict(8.5)).toBe("Highly recommended");
    expect(computeVerdict(10)).toBe("Highly recommended");
  });

  it("returns 'You'll probably enjoy this' for scores >= 6.5 and < 8", () => {
    expect(computeVerdict(6.5)).toBe("You'll probably enjoy this");
    expect(computeVerdict(7)).toBe("You'll probably enjoy this");
    expect(computeVerdict(7.9)).toBe("You'll probably enjoy this");
  });

  it("returns 'Mixed signals' for scores >= 5 and < 6.5", () => {
    expect(computeVerdict(5)).toBe("Mixed signals");
    expect(computeVerdict(5.5)).toBe("Mixed signals");
    expect(computeVerdict(6.4)).toBe("Mixed signals");
  });

  it("returns 'Might not be for you' for scores < 5", () => {
    expect(computeVerdict(4.9)).toBe("Might not be for you");
    expect(computeVerdict(1)).toBe("Might not be for you");
    expect(computeVerdict(0)).toBe("Might not be for you");
  });

  it("handles exact boundary values correctly", () => {
    expect(computeVerdict(8)).toBe("Highly recommended");
    expect(computeVerdict(6.5)).toBe("You'll probably enjoy this");
    expect(computeVerdict(5)).toBe("Mixed signals");
    expect(computeVerdict(4.999)).toBe("Might not be for you");
  });
});
