import { describe, expect, it, vi } from "vitest";

// viewing-habits.ts imports db at module level; mock it so we can test the
// pure helpers without a live database.
vi.mock("@/lib/db", () => ({ db: {} }));

import {
  buildWeekdayHistogram,
  computeAvgSessionMinutes,
  formatSessionLength,
} from "@/lib/stats/viewing-habits";

describe("buildWeekdayHistogram", () => {
  it("returns seven buckets ordered Monday through Sunday", () => {
    const result = buildWeekdayHistogram([]);
    expect(result.map((b) => b.day)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });

  it("fills missing weekdays with a zero count", () => {
    // Only Friday (Postgres DOW 5) has sessions.
    const result = buildWeekdayHistogram([{ dow: 5, count: "3" }]);
    expect(result).toEqual([
      { day: "Mon", count: 0, isPeak: false },
      { day: "Tue", count: 0, isPeak: false },
      { day: "Wed", count: 0, isPeak: false },
      { day: "Thu", count: 0, isPeak: false },
      { day: "Fri", count: 3, isPeak: true },
      { day: "Sat", count: 0, isPeak: false },
      { day: "Sun", count: 0, isPeak: false },
    ]);
  });

  it("maps Postgres DOW (0=Sunday) onto the Monday-first layout", () => {
    // DOW 0 is Sunday, DOW 1 is Monday, DOW 6 is Saturday.
    const result = buildWeekdayHistogram([
      { dow: 0, count: "10" }, // Sunday
      { dow: 1, count: "2" }, // Monday
      { dow: 6, count: "4" }, // Saturday
    ]);
    const byDay = Object.fromEntries(result.map((b) => [b.day, b.count]));
    expect(byDay.Mon).toBe(2);
    expect(byDay.Sat).toBe(4);
    expect(byDay.Sun).toBe(10);
  });

  it("flags only the single peak day when one day clearly leads", () => {
    const result = buildWeekdayHistogram([
      { dow: 1, count: 4 },
      { dow: 0, count: 38 }, // Sunday dominates
      { dow: 6, count: 14 },
    ]);
    const peaks = result.filter((b) => b.isPeak).map((b) => b.day);
    expect(peaks).toEqual(["Sun"]);
  });

  it("does not flag any peak when every day is zero", () => {
    const result = buildWeekdayHistogram([]);
    expect(result.some((b) => b.isPeak)).toBe(false);
  });

  it("coerces string and number counts from Kysely aggregates", () => {
    const result = buildWeekdayHistogram([
      { dow: 1, count: "7" },
      { dow: 2, count: 9n },
    ]);
    const byDay = Object.fromEntries(result.map((b) => [b.day, b.count]));
    expect(byDay.Mon).toBe(7);
    expect(byDay.Tue).toBe(9);
  });

  it("flags the first peak day in Monday-first order on a tie", () => {
    // Tuesday and Thursday tie; the earlier weekday (Tue) is the single peak so
    // exactly one bar highlights, matching the kit's single-amber-bar design.
    const result = buildWeekdayHistogram([
      { dow: 2, count: 8 }, // Tuesday
      { dow: 4, count: 8 }, // Thursday
    ]);
    const peaks = result.filter((b) => b.isPeak).map((b) => b.day);
    expect(peaks).toEqual(["Tue"]);
  });
});

describe("computeAvgSessionMinutes", () => {
  it("returns null when there are no sessions", () => {
    expect(computeAvgSessionMinutes([])).toBeNull();
  });

  it("averages the per-session minutes", () => {
    expect(computeAvgSessionMinutes([{ minutes: 120 }, { minutes: 138 }])).toBe(129);
  });

  it("rounds the average to a whole minute", () => {
    // (90 + 91) / 2 = 90.5 → 91
    expect(computeAvgSessionMinutes([{ minutes: 90 }, { minutes: 91 }])).toBe(91);
  });

  it("coerces string minutes from a Kysely aggregate", () => {
    expect(computeAvgSessionMinutes([{ minutes: "120" }, { minutes: "60" }])).toBe(90);
  });

  it("ignores sessions with zero runtime so missing data does not drag the average down", () => {
    // A session whose media has no runtime contributes 0 and would skew the
    // average; it should be excluded from both the sum and the divisor.
    expect(computeAvgSessionMinutes([{ minutes: 120 }, { minutes: 0 }])).toBe(120);
  });

  it("returns null when every session has zero runtime", () => {
    expect(computeAvgSessionMinutes([{ minutes: 0 }, { minutes: 0 }])).toBeNull();
  });
});

describe("formatSessionLength", () => {
  it("returns null for a null input", () => {
    expect(formatSessionLength(null)).toBeNull();
  });

  it("formats hours and minutes as Xh Ym", () => {
    expect(formatSessionLength(138)).toBe("2h 18m");
  });

  it("omits the hour part for a sub-hour length", () => {
    expect(formatSessionLength(45)).toBe("45m");
  });

  it("omits the minute part on a whole hour", () => {
    expect(formatSessionLength(120)).toBe("2h");
  });
});
