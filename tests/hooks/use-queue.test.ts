import { describe, expect, it } from "vitest";

import {
  applyVoteFlip,
  formatScheduledDate,
  type QueueMedia,
  type QueueProposalView,
  type QueueState,
  scheduleButtonLabel,
  toDateInputValue,
  wonVoteLine,
} from "@/hooks/use-queue";

describe("toDateInputValue", () => {
  it("returns an empty string for a dateless pick", () => {
    expect(toDateInputValue(null)).toBe("");
  });

  it("converts the ISO-timestamp wire shape to a YYYY-MM-DD input value", () => {
    expect(toDateInputValue("2026-07-01T00:00:00.000Z")).toBe("2026-07-01");
  });

  it("passes a bare date through unchanged", () => {
    expect(toDateInputValue("2026-07-01")).toBe("2026-07-01");
  });
});

describe("formatScheduledDate", () => {
  it("returns the dateless sentinel when there is no date", () => {
    expect(formatScheduledDate(null)).toBe("NO DATE YET");
  });

  it("formats an ISO date as a weekday · month day label", () => {
    // 2026-07-01 is a Wednesday.
    expect(formatScheduledDate("2026-07-01")).toBe("Wed · Jul 1");
  });

  it("formats the real serialized-timestamp wire shape (a Postgres date)", () => {
    // The GET serializes `scheduled_date` (a Postgres `date`) as a full ISO
    // timestamp at UTC midnight, not a bare date — this is what actually arrives.
    expect(formatScheduledDate("2026-07-01T00:00:00.000Z")).toBe("Wed · Jul 1");
  });
});

describe("scheduleButtonLabel", () => {
  it("invites setting a date when there is none", () => {
    expect(scheduleButtonLabel(null)).toBe("Set date");
  });

  it("offers changing the date when one exists", () => {
    expect(scheduleButtonLabel("2026-07-01")).toBe("Change date");
  });
});

describe("wonVoteLine", () => {
  it("renders the frozen X to Y tally", () => {
    expect(wonVoteLine({ wonVotes: 5, runnerUpVotes: 3 })).toBe("Won the vote, 5 to 3");
  });

  it("returns null when the tally was never captured (e.g. seeded scheduled pick)", () => {
    expect(wonVoteLine({ wonVotes: null, runnerUpVotes: null })).toBeNull();
  });

  it("handles an unopposed win (runner-up 0)", () => {
    expect(wonVoteLine({ wonVotes: 2, runnerUpVotes: 0 })).toBe("Won the vote, 2 to 0");
  });

  it("phrases an equal tally as a tie-break win, not a contradictory 'X to X'", () => {
    // The oldest-proposal tie-break can promote a pick with the same vote count
    // as the runner-up. "Won the vote, 2 to 2" reads like a contradiction.
    expect(wonVoteLine({ wonVotes: 2, runnerUpVotes: 2 })).toBe("Won on the tie-break, 2 each");
  });

  it("reads 'First in the queue' for an unopposed auto-scheduled bootstrap pick", () => {
    // The first proposal on an empty queue auto-fills the slot with 0 votes and
    // no real contest — there was no vote to "win".
    expect(wonVoteLine({ wonVotes: 0, runnerUpVotes: 0 })).toBe("First in the queue");
  });
});

function media(id: string): QueueMedia {
  return { id: `m-${id}`, title: id, type: "movie", posterUrl: null };
}

function proposal(overrides: Partial<QueueProposalView> & { id: string }): QueueProposalView {
  return {
    status: "proposed",
    scheduledDate: null,
    proposedAt: "2026-01-01T00:00:00.000Z",
    voteCount: 0,
    hasVoted: false,
    wonVotes: null,
    runnerUpVotes: null,
    media: media(overrides.id),
    proposer: null,
    ...overrides,
  };
}

describe("applyVoteFlip", () => {
  it("returns undefined when there is no cached state to flip", () => {
    expect(applyVoteFlip(undefined, "p1", true)).toBeUndefined();
  });

  it("adds the vote: increments the count and marks hasVoted true", () => {
    const state: QueueState = {
      scheduled: null,
      proposals: [proposal({ id: "p1", voteCount: 2, hasVoted: false })],
    };

    const next = applyVoteFlip(state, "p1", true);

    expect(next?.proposals[0]?.voteCount).toBe(3);
    expect(next?.proposals[0]?.hasVoted).toBe(true);
  });

  it("removes the vote: decrements the count and marks hasVoted false", () => {
    const state: QueueState = {
      scheduled: null,
      proposals: [proposal({ id: "p1", voteCount: 2, hasVoted: true })],
    };

    const next = applyVoteFlip(state, "p1", false);

    expect(next?.proposals[0]?.voteCount).toBe(1);
    expect(next?.proposals[0]?.hasVoted).toBe(false);
  });

  it("never lets the optimistic count drop below zero", () => {
    const state: QueueState = {
      scheduled: null,
      proposals: [proposal({ id: "p1", voteCount: 0, hasVoted: true })],
    };

    const next = applyVoteFlip(state, "p1", false);

    expect(next?.proposals[0]?.voteCount).toBe(0);
  });

  it("re-ranks the list when a vote lifts a proposal above another", () => {
    const state: QueueState = {
      scheduled: null,
      proposals: [
        proposal({ id: "top", voteCount: 3, proposedAt: "2026-01-01T00:00:00.000Z" }),
        proposal({ id: "challenger", voteCount: 2, proposedAt: "2026-01-02T00:00:00.000Z" }),
      ],
    };

    // Challenger gets a 3rd vote -> ties top at 3, but top is older so top stays #1.
    const tied = applyVoteFlip(state, "challenger", true);
    expect(tied?.proposals.map((p) => p.media.id.slice(2))).toEqual(["top", "challenger"]);

    // A 4th vote pushes challenger to 4 -> it now outranks top.
    const lifted = applyVoteFlip(
      { scheduled: null, proposals: tied?.proposals ?? [] },
      "challenger",
      true,
    );
    expect(lifted?.proposals.map((p) => p.media.id.slice(2))).toEqual(["challenger", "top"]);
  });

  it("breaks a re-rank tie by oldest proposal (proposed_at ASC)", () => {
    const state: QueueState = {
      scheduled: null,
      proposals: [
        proposal({ id: "newer", voteCount: 5, proposedAt: "2026-03-01T00:00:00.000Z" }),
        proposal({ id: "older", voteCount: 4, proposedAt: "2026-01-01T00:00:00.000Z" }),
      ],
    };

    // older catches up to 5; equal votes -> the older proposal wins the tie-break.
    const next = applyVoteFlip(state, "older", true);
    expect(next?.proposals.map((p) => p.media.id.slice(2))).toEqual(["older", "newer"]);
  });

  it("updates the scheduled pick's count in place without moving it into the list", () => {
    const scheduled = proposal({ id: "sched", status: "scheduled", voteCount: 1, hasVoted: false });
    const state: QueueState = {
      scheduled,
      proposals: [proposal({ id: "p1", voteCount: 0 })],
    };

    const next = applyVoteFlip(state, "sched", true);

    expect(next?.scheduled?.voteCount).toBe(2);
    expect(next?.scheduled?.hasVoted).toBe(true);
    // The scheduled pick stays in its slot; the list is untouched.
    expect(next?.proposals).toHaveLength(1);
    expect(next?.proposals[0]?.media.id).toBe("m-p1");
  });

  it("leaves state unchanged when the proposal id is unknown", () => {
    const state: QueueState = {
      scheduled: null,
      proposals: [proposal({ id: "p1", voteCount: 2, hasVoted: false })],
    };

    const next = applyVoteFlip(state, "does-not-exist", true);

    expect(next?.proposals[0]?.voteCount).toBe(2);
    expect(next?.proposals[0]?.hasVoted).toBe(false);
  });
});
