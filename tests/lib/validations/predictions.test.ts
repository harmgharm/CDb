import { describe, expect, it } from "vitest";

import {
  batchPredictionRequestSchema,
  predictionRequestSchema,
} from "@/lib/validations/predictions";

describe("predictionRequestSchema", () => {
  it("accepts mediaId with mediaType", () => {
    const result = predictionRequestSchema.safeParse({
      mediaId: "550e8400-e29b-41d4-a716-446655440000",
      mediaType: "movie",
    });
    expect(result.success).toBe(true);
  });

  it("accepts tmdbId with mediaType", () => {
    const result = predictionRequestSchema.safeParse({ tmdbId: 123, mediaType: "tv" });
    expect(result.success).toBe(true);
  });

  it("accepts malId with mediaType", () => {
    const result = predictionRequestSchema.safeParse({ malId: 456, mediaType: "anime" });
    expect(result.success).toBe(true);
  });

  it("rejects when no ID is provided", () => {
    const result = predictionRequestSchema.safeParse({ mediaType: "movie" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid mediaType", () => {
    const result = predictionRequestSchema.safeParse({ tmdbId: 1, mediaType: "podcast" });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive tmdbId", () => {
    const result = predictionRequestSchema.safeParse({ tmdbId: 0, mediaType: "movie" });
    expect(result.success).toBe(false);
  });

  it("accepts multiple IDs simultaneously", () => {
    const result = predictionRequestSchema.safeParse({
      mediaId: "550e8400-e29b-41d4-a716-446655440000",
      tmdbId: 123,
      mediaType: "movie",
    });
    expect(result.success).toBe(true);
  });
});

describe("batchPredictionRequestSchema", () => {
  const validItem = {
    key: "item-1",
    tmdbId: 123,
    mediaType: "movie" as const,
  };

  it("accepts valid batch with one item", () => {
    const result = batchPredictionRequestSchema.safeParse({ items: [validItem] });
    expect(result.success).toBe(true);
  });

  it("accepts batch with multiple items", () => {
    const items = Array.from({ length: 5 }, (_, index) => ({
      ...validItem,
      key: `item-${String(index)}`,
      tmdbId: index + 1,
    }));
    const result = batchPredictionRequestSchema.safeParse({ items });
    expect(result.success).toBe(true);
  });

  it("rejects empty items array", () => {
    const result = batchPredictionRequestSchema.safeParse({ items: [] });
    expect(result.success).toBe(false);
  });

  it("rejects more than 50 items", () => {
    const items = Array.from({ length: 51 }, (_, index) => ({
      ...validItem,
      key: `item-${String(index)}`,
    }));
    const result = batchPredictionRequestSchema.safeParse({ items });
    expect(result.success).toBe(false);
  });

  it("accepts exactly 50 items", () => {
    const items = Array.from({ length: 50 }, (_, index) => ({
      ...validItem,
      key: `item-${String(index)}`,
    }));
    const result = batchPredictionRequestSchema.safeParse({ items });
    expect(result.success).toBe(true);
  });

  it("rejects item with empty key", () => {
    const result = batchPredictionRequestSchema.safeParse({
      items: [{ ...validItem, key: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects item with no ID", () => {
    const result = batchPredictionRequestSchema.safeParse({
      items: [{ key: "item-1", mediaType: "movie" }],
    });
    expect(result.success).toBe(false);
  });
});
