import { describe, expect, it } from "vitest";

import { getInitials } from "@/lib/users/initials";

describe("getInitials", () => {
  it("takes the first letter of each word in the display name", () => {
    expect(getInitials("John Doe", "johnd")).toBe("JD");
  });

  it("caps multi-word names at two letters", () => {
    expect(getInitials("Mary Jane Watson", "mj")).toBe("MJ");
  });

  it("returns a single letter for a one-word name (not the first two characters)", () => {
    // The old game-leaderboard copy used a raw slice(0, 2) and rendered "CI" here.
    expect(getInitials(null, "cinnamonbread19")).toBe("C");
  });

  it("uppercases the result", () => {
    expect(getInitials("jane doe", "jane")).toBe("JD");
  });

  it("falls back to username when display name is null", () => {
    expect(getInitials(null, "trent")).toBe("T");
  });

  it("falls back to username when display name is empty", () => {
    expect(getInitials("", "trent")).toBe("T");
  });

  it("ignores repeated spaces between words", () => {
    expect(getInitials("John  Doe", "johnd")).toBe("JD");
  });
});
