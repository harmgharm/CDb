import { describe, expect, it } from "vitest";

import { createSessionSchema, ratingSchema, updateRatingSchema } from "@/lib/validations/sessions";

describe("createSessionSchema", () => {
  const validSession = {
    mediaId: "550e8400-e29b-41d4-a716-446655440000",
    dateWatched: "2024-01-15",
    attendeeIds: ["550e8400-e29b-41d4-a716-446655440001"],
  };

  it("accepts valid session", () => {
    const result = createSessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it("keeps dateWatched as a YYYY-MM-DD string (no Date coercion)", () => {
    // A calendar date written to a Postgres `date` column must stay a literal
    // string — coercing to a Date forces UTC midnight, which a non-UTC server
    // shifts back a day on store (the off-by-one fixed for the queue too).
    const result = createSessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.dateWatched).toBe("2024-01-15");
  });

  it("requires at least one attendee", () => {
    const result = createSessionSchema.safeParse({ ...validSession, attendeeIds: [] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid media UUID", () => {
    const result = createSessionSchema.safeParse({ ...validSession, mediaId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("accepts optional time in HH:MM format", () => {
    const result = createSessionSchema.safeParse({
      ...validSession,
      timeWatchedAt: "20:30",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid time format", () => {
    const result = createSessionSchema.safeParse({
      ...validSession,
      timeWatchedAt: "8:30 PM",
    });
    expect(result.success).toBe(false);
  });

  it("accepts nullable pickedByUserId", () => {
    const result = createSessionSchema.safeParse({ ...validSession, pickedByUserId: null });
    expect(result.success).toBe(true);
  });

  it("accepts session without dateWatched", () => {
    const { dateWatched: _, ...withoutDate } = validSession;
    const result = createSessionSchema.safeParse(withoutDate);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.dateWatched).toBeUndefined();
  });

  it("accepts null dateWatched", () => {
    const result = createSessionSchema.safeParse({ ...validSession, dateWatched: null });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.dateWatched).toBeNull();
  });

  it("accepts optional notes up to 1000 chars", () => {
    const result = createSessionSchema.safeParse({
      ...validSession,
      notes: "Great movie night!",
    });
    expect(result.success).toBe(true);
  });

  it("rejects notes over 1000 chars", () => {
    const result = createSessionSchema.safeParse({
      ...validSession,
      notes: "a".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});

describe("ratingSchema", () => {
  const validRating = {
    sessionId: "550e8400-e29b-41d4-a716-446655440000",
    score: 8,
  };

  it("accepts valid rating", () => {
    const result = ratingSchema.safeParse(validRating);
    expect(result.success).toBe(true);
  });

  it("accepts score at minimum (1)", () => {
    const result = ratingSchema.safeParse({ ...validRating, score: 1 });
    expect(result.success).toBe(true);
  });

  it("accepts score at maximum (10)", () => {
    const result = ratingSchema.safeParse({ ...validRating, score: 10 });
    expect(result.success).toBe(true);
  });

  it("rejects score below 1", () => {
    const result = ratingSchema.safeParse({ ...validRating, score: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects score above 10", () => {
    const result = ratingSchema.safeParse({ ...validRating, score: 11 });
    expect(result.success).toBe(false);
  });

  it("accepts decimal scores (e.g., 7.5)", () => {
    const result = ratingSchema.safeParse({ ...validRating, score: 7.5 });
    expect(result.success).toBe(true);
  });

  it("accepts optional review up to 1000 chars", () => {
    const result = ratingSchema.safeParse({ ...validRating, review: "Loved it!" });
    expect(result.success).toBe(true);
  });

  it("accepts null review to clear it", () => {
    const result = ratingSchema.safeParse({ ...validRating, review: null });
    expect(result.success).toBe(true);
  });

  it("rejects invalid session UUID", () => {
    const result = ratingSchema.safeParse({ ...validRating, sessionId: "bad-id" });
    expect(result.success).toBe(false);
  });
});

describe("updateRatingSchema", () => {
  it("accepts null review to clear an existing review", () => {
    const result = updateRatingSchema.safeParse({ review: null });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.review).toBeNull();
  });

  it("accepts a review string", () => {
    const result = updateRatingSchema.safeParse({ review: "Updated thoughts" });
    expect(result.success).toBe(true);
  });

  it("accepts score-only updates", () => {
    const result = updateRatingSchema.safeParse({ score: 9 });
    expect(result.success).toBe(true);
  });

  it("rejects review over 1000 chars", () => {
    const result = updateRatingSchema.safeParse({ review: "a".repeat(1001) });
    expect(result.success).toBe(false);
  });
});
