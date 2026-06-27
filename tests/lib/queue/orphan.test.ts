import { describe, expect, it } from "vitest";

import { isMediaOrphaned } from "@/lib/queue/orphan";

describe("isMediaOrphaned", () => {
  it("is an orphan when nothing unrecoverable references the media", () => {
    expect(isMediaOrphaned({ sessionCount: 0, activeProposalCount: 0 })).toBe(true);
  });

  it("is an orphan even when only watchlist entries reference it (they downgrade to external-only, migration 0030)", () => {
    // Watchlist entries are no longer a guard — reclaiming the media row leaves
    // the bookmark intact as external-only rather than destroying it.
    expect(isMediaOrphaned({ sessionCount: 0, activeProposalCount: 0 })).toBe(true);
  });

  it("is NOT an orphan when a watch session references it (would cascade-delete the session)", () => {
    expect(isMediaOrphaned({ sessionCount: 1, activeProposalCount: 0 })).toBe(false);
  });

  it("is NOT an orphan when another active proposal still references it", () => {
    expect(isMediaOrphaned({ sessionCount: 0, activeProposalCount: 1 })).toBe(false);
  });

  it("is NOT an orphan when multiple reference types are present", () => {
    expect(isMediaOrphaned({ sessionCount: 3, activeProposalCount: 2 })).toBe(false);
  });
});
