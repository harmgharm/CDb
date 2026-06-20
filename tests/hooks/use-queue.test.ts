import { describe, expect, it } from "vitest";

import {
  formatScheduledDate,
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
