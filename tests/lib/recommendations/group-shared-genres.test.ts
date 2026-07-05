import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test" } }));

import { findSharedGenres } from "@/lib/recommendations/group";

function preference(userId: string, genres: Record<string, number>) {
  return { userId, topGenres: new Map(Object.entries(genres)) };
}

describe("findSharedGenres", () => {
  it("prefers the strict all-users intersection when it exists", () => {
    const result = findSharedGenres([
      preference("a", { Action: 8, Drama: 7.5 }),
      preference("b", { Action: 9, Horror: 8 }),
    ]);

    expect(result.genres).toEqual(["Action"]);
    expect(result.sharedByAll).toBe(true);
  });

  it("falls back to majority-shared genres when the intersection is empty", () => {
    // No genre is loved by all four, but Sci-Fi is loved by three.
    const result = findSharedGenres([
      preference("a", { "Sci-Fi": 8, Fantasy: 7 }),
      preference("b", { "Sci-Fi": 9, History: 8 }),
      preference("c", { "Sci-Fi": 7.5, History: 7 }),
      preference("d", { Drama: 8, Horror: 7 }),
    ]);

    expect(result.genres).toContain("Sci-Fi");
    expect(result.sharedByAll).toBe(false);
  });

  it("requires at least two users to share a genre in the fallback", () => {
    // Two users with fully disjoint tastes: no majority either.
    const result = findSharedGenres([
      preference("a", { Action: 8 }),
      preference("b", { Drama: 9 }),
    ]);

    expect(result.genres).toEqual([]);
  });

  it("caps the result at the top 3 genres by average rating", () => {
    const result = findSharedGenres([
      preference("a", { A: 9, B: 8, C: 7, D: 7.2, E: 8.5 }),
      preference("b", { A: 9, B: 8, C: 7, D: 7.2, E: 8.5 }),
    ]);

    expect(result.genres).toHaveLength(3);
    expect(result.genres).toEqual(["A", "E", "B"]);
  });
});
