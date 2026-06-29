import { describe, expect, it } from "vitest";

import { coerceAvgRating, mapMediaListRow } from "@/lib/media/list-row";

describe("coerceAvgRating", () => {
  it("returns null when the raw value is null", () => {
    expect(coerceAvgRating(null)).toBeNull();
  });

  it("returns null when the raw value is undefined (column not selected)", () => {
    expect(coerceAvgRating(undefined)).toBeNull();
  });

  it("parses a Postgres numeric string and rounds to one decimal", () => {
    // AVG() comes back as a numeric string from the driver, e.g. "8.4285714".
    expect(coerceAvgRating("8.4285714")).toBe(8.4);
  });

  it("rounds half up at the first decimal", () => {
    expect(coerceAvgRating("7.25")).toBe(7.3);
  });

  it("accepts an already-numeric value", () => {
    expect(coerceAvgRating(9)).toBe(9);
  });

  it("returns null for a non-numeric string rather than NaN", () => {
    expect(coerceAvgRating("not a number")).toBeNull();
  });
});

describe("mapMediaListRow", () => {
  it("attaches a coerced avg_rating to the row, leaving other fields untouched", () => {
    const row = {
      id: "m1",
      title: "Atlas Drift",
      type: "movie",
      release_year: 2025,
      avg_rating: "8.4285714",
    };

    const result = mapMediaListRow(row);

    expect(result).toMatchObject({
      id: "m1",
      title: "Atlas Drift",
      type: "movie",
      release_year: 2025,
      avg_rating: 8.4,
    });
  });

  it("sets avg_rating to null when the row's rating is null (no group ratings yet)", () => {
    const row = { id: "m2", title: "Unrated", avg_rating: null };

    expect(mapMediaListRow(row).avg_rating).toBeNull();
  });

  it("sets avg_rating to null when the aggregate is undefined", () => {
    // The route always selects avg_rating, but the helper still defends against
    // an undefined aggregate (coerceAvgRating covers the parsing edge cases).
    const row = { id: "m3", title: "No score", avg_rating: undefined };

    expect(mapMediaListRow(row).avg_rating).toBeNull();
  });
});
