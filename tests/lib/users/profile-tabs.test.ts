import { describe, expect, it } from "vitest";

import { isProfileTab, PROFILE_TABS, resolveProfileTab } from "@/lib/users/profile-tabs";

describe("resolveProfileTab", () => {
  it("defaults to overview when there is no tab param", () => {
    expect(resolveProfileTab(null)).toBe("overview");
  });

  it("passes through each known tab value", () => {
    for (const tab of PROFILE_TABS) {
      expect(resolveProfileTab(tab)).toBe(tab);
    }
  });

  it("falls back to overview for an unknown tab value", () => {
    expect(resolveProfileTab("bogus")).toBe("overview");
  });

  it("is case-sensitive — does not accept a differently-cased value", () => {
    expect(resolveProfileTab("Watchlist")).toBe("overview");
  });

  it("falls back to overview for an empty string", () => {
    expect(resolveProfileTab("")).toBe("overview");
  });
});

describe("isProfileTab", () => {
  it("recognizes every known tab", () => {
    for (const tab of PROFILE_TABS) {
      expect(isProfileTab(tab)).toBe(true);
    }
  });

  it("rejects an unknown value", () => {
    expect(isProfileTab("bogus")).toBe(false);
  });
});
