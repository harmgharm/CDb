import { describe, expect, it } from "vitest";

import { proposeSchema, scheduleSchema } from "@/lib/validations/queue";

describe("proposeSchema", () => {
  it("accepts a valid media UUID", () => {
    const result = proposeSchema.safeParse({
      mediaId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing mediaId", () => {
    expect(proposeSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-UUID mediaId", () => {
    expect(proposeSchema.safeParse({ mediaId: "not-a-uuid" }).success).toBe(false);
  });
});

describe("scheduleSchema", () => {
  it("keeps a YYYY-MM-DD date as a plain string (no Date coercion)", () => {
    // A calendar date has no time/zone — coercing to a Date shifts it across a
    // non-UTC server's midnight (off-by-one). Keep it as the literal string.
    const result = scheduleSchema.safeParse({ scheduledDate: "2026-07-01" });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.scheduledDate).toBe("2026-07-01");
  });

  it("accepts null to clear the date (back to dateless)", () => {
    const result = scheduleSchema.safeParse({ scheduledDate: null });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.scheduledDate).toBeNull();
  });

  it("requires the scheduledDate key to be present", () => {
    // An empty body is not a valid "set/change date" request.
    expect(scheduleSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-date string", () => {
    expect(scheduleSchema.safeParse({ scheduledDate: "not-a-date" }).success).toBe(false);
  });

  it("rejects a malformed date shape", () => {
    expect(scheduleSchema.safeParse({ scheduledDate: "2026-7-1" }).success).toBe(false);
  });
});
