import { describe, expect, it } from "vitest";

import { shouldBackfill } from "@/lib/recommendations/backfill";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-07-04T12:00:00Z");
const staleComputedAt = new Date(now.getTime() - 2 * HOUR);
const freshComputedAt = new Date(now.getTime() - 5 * 60 * 1000);

describe("shouldBackfill", () => {
  it("backfills a stale cached section thinned below the threshold", () => {
    expect(
      shouldBackfill({
        refresh: false,
        filteredCount: 3,
        fromCache: true,
        computedAt: staleComputedAt,
        now,
      }),
    ).toBe(true);
  });

  it("does not backfill when the section was computed fresh this request", () => {
    // Recomputing immediately cannot produce more items — this was the
    // every-request recompute loop for sections that can never reach the threshold.
    expect(
      shouldBackfill({
        refresh: false,
        filteredCount: 3,
        fromCache: false,
        computedAt: null,
        now,
      }),
    ).toBe(false);
  });

  it("does not backfill a recently computed cache entry", () => {
    expect(
      shouldBackfill({
        refresh: false,
        filteredCount: 3,
        fromCache: true,
        computedAt: freshComputedAt,
        now,
      }),
    ).toBe(false);
  });

  it("does not backfill when the section already has enough items", () => {
    expect(
      shouldBackfill({
        refresh: false,
        filteredCount: 20,
        fromCache: true,
        computedAt: staleComputedAt,
        now,
      }),
    ).toBe(false);
  });

  it("does not backfill on an explicit refresh (already recomputed)", () => {
    expect(
      shouldBackfill({
        refresh: true,
        filteredCount: 3,
        fromCache: false,
        computedAt: null,
        now,
      }),
    ).toBe(false);
  });
});
