import { describe, expect, it } from "vitest";

import type { RankableProposal } from "@/lib/queue/ranking";
import {
  capturePromotionTally,
  decideFill,
  decideWatchClose,
  isHistoricalBackfill,
  pickNextScheduled,
  rankProposals,
} from "@/lib/queue/ranking";

function makeProposal(overrides: Partial<RankableProposal> = {}): RankableProposal {
  return {
    id: "p-default",
    voteCount: 0,
    proposedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("rankProposals", () => {
  it("orders by vote count descending", () => {
    const low = makeProposal({ id: "low", voteCount: 1 });
    const high = makeProposal({ id: "high", voteCount: 5 });
    const mid = makeProposal({ id: "mid", voteCount: 3 });

    const ranked = rankProposals([low, high, mid]);

    expect(ranked.map((p) => p.id)).toEqual(["high", "mid", "low"]);
  });

  it("breaks vote ties by oldest proposal (proposed_at ASC)", () => {
    const newer = makeProposal({
      id: "newer",
      voteCount: 3,
      proposedAt: new Date("2026-02-01T00:00:00Z"),
    });
    const older = makeProposal({
      id: "older",
      voteCount: 3,
      proposedAt: new Date("2026-01-01T00:00:00Z"),
    });

    const ranked = rankProposals([newer, older]);

    expect(ranked.map((p) => p.id)).toEqual(["older", "newer"]);
  });

  it("applies votes-first then oldest tie-break together", () => {
    const a = makeProposal({ id: "a", voteCount: 2, proposedAt: new Date("2026-01-03T00:00:00Z") });
    const b = makeProposal({ id: "b", voteCount: 5, proposedAt: new Date("2026-01-02T00:00:00Z") });
    const c = makeProposal({ id: "c", voteCount: 2, proposedAt: new Date("2026-01-01T00:00:00Z") });

    const ranked = rankProposals([a, b, c]);

    // b wins on votes; a and c tie on votes, c is older so it ranks above a
    expect(ranked.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      makeProposal({ id: "x", voteCount: 1 }),
      makeProposal({ id: "y", voteCount: 9 }),
    ];
    const before = input.map((p) => p.id);

    rankProposals(input);

    expect(input.map((p) => p.id)).toEqual(before);
  });

  it("returns an empty array unchanged", () => {
    expect(rankProposals([])).toEqual([]);
  });
});

describe("pickNextScheduled", () => {
  it("returns the top-ranked proposal", () => {
    const winner = makeProposal({ id: "winner", voteCount: 4 });
    const runnerUp = makeProposal({ id: "runner-up", voteCount: 2 });

    expect(pickNextScheduled([runnerUp, winner])?.id).toBe("winner");
  });

  it("returns null when there are no proposals", () => {
    expect(pickNextScheduled([])).toBeNull();
  });

  it("uses the oldest-proposal tie-break to choose the promotion", () => {
    const newer = makeProposal({
      id: "newer",
      voteCount: 3,
      proposedAt: new Date("2026-05-01T00:00:00Z"),
    });
    const older = makeProposal({
      id: "older",
      voteCount: 3,
      proposedAt: new Date("2026-04-01T00:00:00Z"),
    });

    expect(pickNextScheduled([newer, older])?.id).toBe("older");
  });
});

describe("isHistoricalBackfill", () => {
  const proposedAt = new Date("2026-07-04T15:00:00Z");

  it("treats an undated session as a current watch (not a backfill)", () => {
    expect(isHistoricalBackfill(null, proposedAt)).toBe(false);
  });

  it("treats a session dated the proposal's day as current", () => {
    expect(isHistoricalBackfill("2026-07-04", proposedAt)).toBe(false);
  });

  it("treats a session dated after the proposal as current", () => {
    expect(isHistoricalBackfill("2026-07-10", proposedAt)).toBe(false);
  });

  it("allows one day of grace before the proposal (member-local date vs UTC instant)", () => {
    // A proposal made late evening local time lands on the NEXT UTC day, so a
    // same-night watch can be dated one calendar day before proposed_at.
    expect(isHistoricalBackfill("2026-07-03", proposedAt)).toBe(false);
  });

  it("flags a session dated two or more days before the proposal as a backfill", () => {
    expect(isHistoricalBackfill("2026-07-02", proposedAt)).toBe(true);
    expect(isHistoricalBackfill("2026-01-15", proposedAt)).toBe(true);
  });

  it("keeps the grace day correct when the proposal is just past UTC midnight", () => {
    const lateEvening = new Date("2026-07-05T02:00:00Z"); // 10pm EDT on the 4th
    expect(isHistoricalBackfill("2026-07-04", lateEvening)).toBe(false);
    expect(isHistoricalBackfill("2026-07-03", lateEvening)).toBe(true);
  });
});

describe("decideWatchClose", () => {
  const proposedAt = new Date("2026-07-04T15:00:00Z");

  it("does nothing when the media has no active proposal", () => {
    expect(decideWatchClose({ proposal: null, dateWatched: null })).toBe("none");
  });

  it("closes a vote-list proposal on an undated (current) watch", () => {
    expect(
      decideWatchClose({ proposal: { status: "proposed", proposedAt }, dateWatched: null }),
    ).toBe("close");
  });

  it("closes and promotes when the watched media is the scheduled pick", () => {
    expect(
      decideWatchClose({ proposal: { status: "scheduled", proposedAt }, dateWatched: null }),
    ).toBe("close-and-promote");
  });

  it("closes a vote-list proposal on a same-day dated watch", () => {
    expect(
      decideWatchClose({
        proposal: { status: "proposed", proposedAt },
        dateWatched: "2026-07-04",
      }),
    ).toBe("close");
  });

  it("leaves a proposal alone when the session is a historical backfill", () => {
    expect(
      decideWatchClose({
        proposal: { status: "proposed", proposedAt },
        dateWatched: "2026-05-01",
      }),
    ).toBe("none");
  });

  it("leaves even the scheduled pick alone on a historical backfill", () => {
    expect(
      decideWatchClose({
        proposal: { status: "scheduled", proposedAt },
        dateWatched: "2026-05-01",
      }),
    ).toBe("none");
  });
});

describe("capturePromotionTally", () => {
  it("captures the winner's and runner-up's vote counts", () => {
    const winner = makeProposal({ id: "winner", voteCount: 5 });
    const runnerUp = makeProposal({ id: "runner-up", voteCount: 3 });
    const third = makeProposal({ id: "third", voteCount: 1 });

    // Order shouldn't matter — it ranks internally.
    expect(capturePromotionTally([third, winner, runnerUp])).toEqual({
      wonVotes: 5,
      runnerUpVotes: 3,
    });
  });

  it("reports a zero runner-up when the winner is the only proposal", () => {
    const onlyOne = makeProposal({ id: "only", voteCount: 4 });

    expect(capturePromotionTally([onlyOne])).toEqual({ wonVotes: 4, runnerUpVotes: 0 });
  });

  it("returns null when there is nothing to promote", () => {
    expect(capturePromotionTally([])).toBeNull();
  });

  it("uses the ranked runner-up (tie-break aware), not input order", () => {
    const winner = makeProposal({ id: "winner", voteCount: 5 });
    // Two tie on 2 votes; the older one is the true runner-up.
    const newerTie = makeProposal({
      id: "newer",
      voteCount: 2,
      proposedAt: new Date("2026-02-01T00:00:00Z"),
    });
    const olderTie = makeProposal({
      id: "older",
      voteCount: 2,
      proposedAt: new Date("2026-01-01T00:00:00Z"),
    });

    // Both ties have 2 votes, so runnerUpVotes is 2 regardless of which —
    // the point is it comes from the ranked #2, consistent with promotion.
    expect(capturePromotionTally([newerTie, winner, olderTie])).toEqual({
      wonVotes: 5,
      runnerUpVotes: 2,
    });
  });
});

describe("decideFill", () => {
  it("returns null when the slot is already occupied (no re-promotion)", () => {
    const candidate = makeProposal({ id: "top", voteCount: 9 });
    // Even with a high-vote candidate, an occupied slot is left stable.
    expect(decideFill({ hasScheduled: true, candidates: [candidate] })).toBeNull();
  });

  it("returns null when the slot is empty but there are no proposals", () => {
    expect(decideFill({ hasScheduled: false, candidates: [] })).toBeNull();
  });

  it("fills an empty slot with the top-ranked proposal", () => {
    const top = makeProposal({ id: "top", voteCount: 4 });
    const other = makeProposal({ id: "other", voteCount: 1 });
    expect(decideFill({ hasScheduled: false, candidates: [other, top] })?.id).toBe("top");
  });

  it("fills an empty slot even when the top proposal has zero votes", () => {
    const only = makeProposal({ id: "only", voteCount: 0 });
    expect(decideFill({ hasScheduled: false, candidates: [only] })?.id).toBe("only");
  });

  it("uses the oldest-proposal tie-break when filling", () => {
    const newer = makeProposal({
      id: "newer",
      voteCount: 2,
      proposedAt: new Date("2026-02-01T00:00:00Z"),
    });
    const older = makeProposal({
      id: "older",
      voteCount: 2,
      proposedAt: new Date("2026-01-01T00:00:00Z"),
    });
    expect(decideFill({ hasScheduled: false, candidates: [newer, older] })?.id).toBe("older");
  });
});
