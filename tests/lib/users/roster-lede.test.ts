import { describe, expect, it } from "vitest";

import { buildRosterLede } from "@/lib/users/roster-lede";

describe("buildRosterLede", () => {
  it("renders members and weeks with the editorial closer", () => {
    expect(buildRosterLede({ memberCount: 6, weeksActive: 23 })).toBe(
      "6 regulars · 23 weeks in, one Sunday slot.",
    );
  });

  it("singularizes a lone member", () => {
    expect(buildRosterLede({ memberCount: 1, weeksActive: 4 })).toBe(
      "1 regular · 4 weeks in, one Sunday slot.",
    );
  });

  it("singularizes week one", () => {
    expect(buildRosterLede({ memberCount: 3, weeksActive: 1 })).toBe(
      "3 regulars · 1 week in, one Sunday slot.",
    );
  });

  it("drops the weeks clause before any session is logged", () => {
    expect(buildRosterLede({ memberCount: 3, weeksActive: null })).toBe(
      "3 regulars, one Sunday slot.",
    );
  });

  it("falls back to an evergreen line when there are no members yet", () => {
    expect(buildRosterLede({ memberCount: 0, weeksActive: null })).toBe(
      "Everyone who shows up for the group's screening room.",
    );
  });

  it("treats a zero member count as the evergreen fallback even with weeks", () => {
    expect(buildRosterLede({ memberCount: 0, weeksActive: 12 })).toBe(
      "Everyone who shows up for the group's screening room.",
    );
  });
});
