import { describe, expect, it } from "vitest";

import { isMediaOrphaned } from "@/lib/queue/orphan";

describe("isMediaOrphaned", () => {
  it("is an orphan when nothing references the media", () => {
    expect(isMediaOrphaned({ sessionCount: 0, activeProposalCount: 0, watchlistCount: 0 })).toBe(
      true,
    );
  });

  it("is NOT an orphan when a watch session references it (would cascade-delete the session)", () => {
    expect(isMediaOrphaned({ sessionCount: 1, activeProposalCount: 0, watchlistCount: 0 })).toBe(
      false,
    );
  });

  it("is NOT an orphan when another active proposal still references it", () => {
    expect(isMediaOrphaned({ sessionCount: 0, activeProposalCount: 1, watchlistCount: 0 })).toBe(
      false,
    );
  });

  it("is NOT an orphan when someone has it on a watchlist (media_id is cascade — would nuke the bookmark)", () => {
    expect(isMediaOrphaned({ sessionCount: 0, activeProposalCount: 0, watchlistCount: 1 })).toBe(
      false,
    );
  });

  it("is NOT an orphan when multiple reference types are present", () => {
    expect(isMediaOrphaned({ sessionCount: 3, activeProposalCount: 2, watchlistCount: 5 })).toBe(
      false,
    );
  });
});
