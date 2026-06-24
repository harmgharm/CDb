import { describe, expect, it } from "vitest";

import {
  resolveSessionRating,
  resolveSessionTake,
  type SessionRatingRow,
  weekNumber,
} from "@/lib/sessions/timeline";

function rating(overrides: Partial<SessionRatingRow> = {}): SessionRatingRow {
  return {
    score: 8,
    review: null,
    username: "sam",
    display_name: "Sam",
    created_at: new Date("2026-06-07T20:00:00Z"),
    ...overrides,
  };
}

describe("weekNumber", () => {
  // 1-based, one distinct number per calendar week from the group's first
  // session (Wk 1 = the first week, Wk 2 = seven days later, ...). The masthead's
  // "N weeks in" footnote is aligned to this same anchor (deriveWeeksSince).
  const first = "2026-06-01";

  it("returns week 1 for the first session", () => {
    expect(weekNumber("2026-06-01", first)).toBe(1);
  });

  it("stays week 1 through the first six days", () => {
    expect(weekNumber("2026-06-07", first)).toBe(1); // day 6
  });

  it("rolls to week 2 exactly seven days in", () => {
    expect(weekNumber("2026-06-08", first)).toBe(2); // day 7
  });

  it("rolls to week 3 at fourteen days in", () => {
    expect(weekNumber("2026-06-15", first)).toBe(3); // day 14
  });

  it("never goes below week 1 (e.g. a session dated before the first)", () => {
    expect(weekNumber("2026-05-25", first)).toBe(1);
  });

  it("returns null when either date is missing", () => {
    expect(weekNumber(null, first)).toBeNull();
    expect(weekNumber("2026-06-08", null)).toBeNull();
  });
});

describe("resolveSessionRating", () => {
  it("returns the average and count of session ratings", () => {
    const result = resolveSessionRating([rating({ score: 7 }), rating({ score: 9 })]);
    expect(result).toEqual({ average: 8, count: 2 });
  });

  it("rounds the average to one decimal place", () => {
    const result = resolveSessionRating([
      rating({ score: 8 }),
      rating({ score: 9 }),
      rating({ score: 9 }),
    ]);
    // (8 + 9 + 9) / 3 = 8.666… -> 8.7
    expect(result).toEqual({ average: 8.7, count: 3 });
  });

  it("returns null when there are no ratings", () => {
    expect(resolveSessionRating([])).toBeNull();
  });
});

describe("resolveSessionTake", () => {
  it("prefers a rating review, attributed to the rater", () => {
    const take = resolveSessionTake({
      ratings: [rating({ score: 9, review: "Best opening of the year.", display_name: "Harm" })],
      notes: null,
      creatorName: "Sam",
    });
    expect(take).toEqual({ text: "Best opening of the year.", by: "Harm" });
  });

  it("picks the highest-scoring reviewer's review when several reviewed", () => {
    const take = resolveSessionTake({
      ratings: [
        rating({ score: 6, review: "It was fine.", display_name: "Alex" }),
        rating({ score: 9, review: "Loved it.", display_name: "Harm" }),
        rating({ score: 7, review: "Solid.", display_name: "Sam" }),
      ],
      notes: null,
      creatorName: "Sam",
    });
    expect(take).toEqual({ text: "Loved it.", by: "Harm" });
  });

  it("breaks a tie among equal-scoring reviewers by oldest review", () => {
    const take = resolveSessionTake({
      ratings: [
        rating({
          score: 9,
          review: "Earlier.",
          display_name: "Harm",
          created_at: new Date("2026-06-07T20:00:00Z"),
        }),
        rating({
          score: 9,
          review: "Later.",
          display_name: "Sam",
          created_at: new Date("2026-06-07T22:00:00Z"),
        }),
      ],
      notes: null,
      creatorName: "Alex",
    });
    expect(take).toEqual({ text: "Earlier.", by: "Harm" });
  });

  it("ignores ratings that have no review when choosing the take", () => {
    const take = resolveSessionTake({
      ratings: [
        rating({ score: 10, review: null, display_name: "Harm" }),
        rating({ score: 6, review: "Quietly great.", display_name: "Riya" }),
      ],
      notes: null,
      creatorName: "Sam",
    });
    expect(take).toEqual({ text: "Quietly great.", by: "Riya" });
  });

  it("falls back to session notes attributed to the creator when no review exists", () => {
    const take = resolveSessionTake({
      ratings: [rating({ score: 8, review: null })],
      notes: "Slow first half, then it grabs you.",
      creatorName: "Jamie",
    });
    expect(take).toEqual({ text: "Slow first half, then it grabs you.", by: "Jamie" });
  });

  it("renders notes without attribution when the creator is unknown", () => {
    const take = resolveSessionTake({
      ratings: [],
      notes: "Cried. No notes.",
      creatorName: null,
    });
    expect(take).toEqual({ text: "Cried. No notes.", by: null });
  });

  it("treats whitespace-only reviews and notes as absent", () => {
    const take = resolveSessionTake({
      ratings: [rating({ score: 9, review: "   " })],
      notes: "  ",
      creatorName: "Sam",
    });
    expect(take).toBeNull();
  });

  it("returns null when there is neither a review nor notes", () => {
    const take = resolveSessionTake({
      ratings: [rating({ score: 8, review: null })],
      notes: null,
      creatorName: "Sam",
    });
    expect(take).toBeNull();
  });

  it("falls back to the username when a reviewer has no display name", () => {
    const take = resolveSessionTake({
      ratings: [rating({ score: 9, review: "Great.", display_name: null, username: "harm" })],
      notes: null,
      creatorName: "Sam",
    });
    expect(take).toEqual({ text: "Great.", by: "harm" });
  });
});
