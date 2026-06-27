import { describe, expect, it } from "vitest";

import {
  createMediaSchema,
  importMediaSchema,
  mediaQuerySchema,
  searchMediaSchema,
  updateMediaSchema,
} from "@/lib/validations/media";

describe("createMediaSchema", () => {
  it("accepts a manual create with a tmdbId", () => {
    const result = createMediaSchema.safeParse({
      title: "Inception",
      type: "movie",
      tmdbId: 27205,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a manual create with a malId", () => {
    const result = createMediaSchema.safeParse({ title: "Naruto", type: "anime", malId: 20 });
    expect(result.success).toBe(true);
  });

  it("rejects a create with neither tmdbId nor malId (would break the media→watchlist downgrade)", () => {
    // A media row with no external id can't anchor a downgraded watchlist entry
    // when the media is deleted (migration 0030's media_external_id_check).
    const result = createMediaSchema.safeParse({ title: "Homemade", type: "movie" });
    expect(result.success).toBe(false);
  });

  it("updateMediaSchema stays lenient — a partial edit need not include an external id", () => {
    const result = updateMediaSchema.safeParse({ title: "Renamed" });
    expect(result.success).toBe(true);
  });
});

describe("importMediaSchema", () => {
  it("accepts tmdbId with type", () => {
    const result = importMediaSchema.safeParse({ tmdbId: 123, type: "movie" });
    expect(result.success).toBe(true);
  });

  it("accepts malId with type", () => {
    const result = importMediaSchema.safeParse({ malId: 456, type: "anime" });
    expect(result.success).toBe(true);
  });

  it("rejects when neither tmdbId nor malId provided", () => {
    const result = importMediaSchema.safeParse({ type: "movie" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid media type", () => {
    const result = importMediaSchema.safeParse({ tmdbId: 1, type: "podcast" });
    expect(result.success).toBe(false);
  });

  it("rejects negative IDs", () => {
    const result = importMediaSchema.safeParse({ tmdbId: -1, type: "movie" });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer IDs", () => {
    const result = importMediaSchema.safeParse({ tmdbId: 1.5, type: "movie" });
    expect(result.success).toBe(false);
  });
});

describe("searchMediaSchema", () => {
  it("accepts valid search query", () => {
    const result = searchMediaSchema.safeParse({ query: "Inception" });
    expect(result.success).toBe(true);
  });

  it("accepts query with optional type filter", () => {
    const result = searchMediaSchema.safeParse({ query: "Naruto", type: "anime" });
    expect(result.success).toBe(true);
  });

  it("rejects empty query", () => {
    const result = searchMediaSchema.safeParse({ query: "" });
    expect(result.success).toBe(false);
  });

  it("rejects query over 200 chars", () => {
    const result = searchMediaSchema.safeParse({ query: "a".repeat(201) });
    expect(result.success).toBe(false);
  });
});

describe("mediaQuerySchema", () => {
  it("provides defaults for pagination and sorting", () => {
    const result = mediaQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.page).toBe(1);
    expect(result.data.limit).toBe(20);
    expect(result.data.sortBy).toBe("created_at");
    expect(result.data.sortOrder).toBe("desc");
  });

  it("coerces string numbers for pagination", () => {
    const result = mediaQuerySchema.safeParse({ page: "3", limit: "50" });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.page).toBe(3);
    expect(result.data.limit).toBe(50);
  });

  it("rejects page less than 1", () => {
    const result = mediaQuerySchema.safeParse({ page: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects limit over 100", () => {
    const result = mediaQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it("accepts all valid sort fields", () => {
    for (const sortBy of ["title", "rating", "date_watched", "release_year", "created_at"]) {
      const result = mediaQuerySchema.safeParse({ sortBy });
      expect(result.success).toBe(true);
    }
  });

  it("rejects release year before 1888", () => {
    const result = mediaQuerySchema.safeParse({ yearFrom: 1800 });
    expect(result.success).toBe(false);
  });
});
