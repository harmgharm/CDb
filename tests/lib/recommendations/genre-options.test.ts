import { describe, expect, it } from "vitest";

import { getMalGenreId } from "@/lib/api/jikan-genres";
import { getMovieGenreId, getTvGenreId } from "@/lib/api/tmdb-genres";
import { CANONICAL_GENRES } from "@/lib/recommendations/genre-options";

describe("CANONICAL_GENRES", () => {
  it("is alphabetically sorted and non-empty", () => {
    expect(CANONICAL_GENRES.length).toBeGreaterThan(20);
    expect([...CANONICAL_GENRES]).toEqual(
      [...CANONICAL_GENRES].toSorted((a, b) => a.localeCompare(b)),
    );
  });

  it("includes the MAL-only genres that used to flicker in and out", () => {
    expect(CANONICAL_GENRES).toContain("Award Winning");
    expect(CANONICAL_GENRES).toContain("Kids");
    expect(CANONICAL_GENRES).toContain("Slice of Life");
    expect(CANONICAL_GENRES).toContain("Supernatural");
  });

  it("merges vocabularies — no separate Military/Suspense/Historical entries", () => {
    expect(CANONICAL_GENRES).toContain("War");
    expect(CANONICAL_GENRES).not.toContain("Military");
    expect(CANONICAL_GENRES).toContain("Thriller");
    expect(CANONICAL_GENRES).not.toContain("Suspense");
    expect(CANONICAL_GENRES).toContain("History");
    expect(CANONICAL_GENRES).not.toContain("Historical");
    expect(CANONICAL_GENRES).toContain("Sci-Fi");
    expect(CANONICAL_GENRES).not.toContain("Science Fiction");
  });

  it("excludes junk TV genres", () => {
    for (const junk of ["News", "Reality", "Soap", "Talk", "TV Movie"]) {
      expect(CANONICAL_GENRES).not.toContain(junk);
    }
  });

  it("every canonical genre resolves to at least one vertical, so no filter word is dead", () => {
    for (const genre of CANONICAL_GENRES) {
      const resolved =
        getMovieGenreId(genre) !== null ||
        getTvGenreId(genre) !== null ||
        getMalGenreId(genre) !== null;
      expect(resolved, `"${genre}" resolves to no movie, TV, or MAL genre id`).toBe(true);
    }
  });
});
