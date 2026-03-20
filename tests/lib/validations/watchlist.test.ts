import { describe, expect, it } from "vitest";

import { addToWatchlistSchema, updateWatchlistEntrySchema } from "@/lib/validations/watchlist";

describe("addToWatchlistSchema", () => {
  it("accepts imported media by mediaId", () => {
    const result = addToWatchlistSchema.safeParse({
      mediaId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("accepts external media by tmdbId with required display fields", () => {
    const result = addToWatchlistSchema.safeParse({
      tmdbId: 123,
      extTitle: "Inception",
      extMediaType: "movie",
    });
    expect(result.success).toBe(true);
  });

  it("accepts external media by malId with required display fields", () => {
    const result = addToWatchlistSchema.safeParse({
      malId: 456,
      extTitle: "Naruto",
      extMediaType: "anime",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when both mediaId AND tmdbId are provided (XOR)", () => {
    const result = addToWatchlistSchema.safeParse({
      mediaId: "550e8400-e29b-41d4-a716-446655440000",
      tmdbId: 123,
      extTitle: "Test",
      extMediaType: "movie",
    });
    expect(result.success).toBe(false);
  });

  it("rejects when neither mediaId nor external ID provided", () => {
    const result = addToWatchlistSchema.safeParse({ status: "planning" });
    expect(result.success).toBe(false);
  });

  it("rejects external media without extTitle", () => {
    const result = addToWatchlistSchema.safeParse({
      tmdbId: 123,
      extMediaType: "movie",
    });
    expect(result.success).toBe(false);
  });

  it("rejects external media without extMediaType", () => {
    const result = addToWatchlistSchema.safeParse({
      tmdbId: 123,
      extTitle: "Inception",
    });
    expect(result.success).toBe(false);
  });

  it("defaults status to 'planning'", () => {
    const result = addToWatchlistSchema.safeParse({
      mediaId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.status).toBe("planning");
  });

  it("accepts all valid statuses", () => {
    for (const status of ["planning", "watching", "scrapped"]) {
      const result = addToWatchlistSchema.safeParse({
        mediaId: "550e8400-e29b-41d4-a716-446655440000",
        status,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = addToWatchlistSchema.safeParse({
      mediaId: "550e8400-e29b-41d4-a716-446655440000",
      status: "completed",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateWatchlistEntrySchema", () => {
  it("accepts status update", () => {
    const result = updateWatchlistEntrySchema.safeParse({ status: "watching" });
    expect(result.success).toBe(true);
  });

  it("accepts notes update", () => {
    const result = updateWatchlistEntrySchema.safeParse({ notes: "Looking forward to this" });
    expect(result.success).toBe(true);
  });

  it("accepts null notes (clearing)", () => {
    const result = updateWatchlistEntrySchema.safeParse({ notes: null });
    expect(result.success).toBe(true);
  });

  it("accepts empty object (no changes)", () => {
    const result = updateWatchlistEntrySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects notes over 1000 chars", () => {
    const result = updateWatchlistEntrySchema.safeParse({ notes: "a".repeat(1001) });
    expect(result.success).toBe(false);
  });
});
