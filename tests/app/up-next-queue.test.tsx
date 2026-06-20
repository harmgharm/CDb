import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import type * as UseQueueModule from "@/hooks/use-queue";
import type { QueueProposalView, UseQueueResult } from "@/hooks/use-queue";

// Mock only the data source — keep the real pure helpers (formatScheduledDate,
// scheduleButtonLabel, wonVoteLine) so the component renders real label logic.
const mockUseQueue = vi.fn<() => UseQueueResult>();
vi.mock("@/hooks/use-queue", async (importOriginal) => {
  const actual = await importOriginal<typeof UseQueueModule>();
  return { ...actual, useQueue: () => mockUseQueue() };
});

// next/image -> plain img so jsdom renders the poster.
vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => React.createElement("img", { src, alt }),
}));

import { UpNextQueue } from "@/app/(main)/home/_components/up-next-queue";

function makeProposal(overrides: Partial<QueueProposalView> = {}): QueueProposalView {
  return {
    id: "p1",
    status: "proposed",
    scheduledDate: null,
    proposedAt: "2026-01-01T00:00:00Z",
    voteCount: 0,
    hasVoted: false,
    wonVotes: null,
    runnerUpVotes: null,
    media: { id: "m1", title: "Dune", type: "movie", posterUrl: null },
    proposer: { id: "u1", username: "harm", displayName: "Harm", avatarUrl: null },
    ...overrides,
  };
}

function result(overrides: Partial<UseQueueResult> = {}): UseQueueResult {
  return {
    scheduled: null,
    proposals: [],
    isLoading: false,
    pendingVotes: new Set(),
    pendingRemovals: new Set(),
    refresh: vi.fn(),
    toggleVote: vi.fn(),
    removeProposal: vi.fn(),
    setScheduledDate: vi.fn(),
    ...overrides,
  };
}

describe("UpNextQueue", () => {
  it("renders the scheduled pick and the ranked vote list", () => {
    const scheduled = makeProposal({
      id: "sched",
      status: "scheduled",
      scheduledDate: "2026-07-01",
      wonVotes: 5,
      runnerUpVotes: 3,
      media: { id: "m0", title: "Sinners", type: "movie", posterUrl: null },
    });
    const proposals = [
      makeProposal({
        id: "a",
        media: { id: "ma", title: "Arcane", type: "anime", posterUrl: null },
      }),
      makeProposal({
        id: "b",
        media: { id: "mb", title: "Severance", type: "tv", posterUrl: null },
      }),
    ];
    mockUseQueue.mockReturnValue(result({ scheduled, proposals }));

    render(<UpNextQueue />);

    expect(screen.getByText("Sinners")).toBeInTheDocument();
    expect(screen.getByText("Arcane")).toBeInTheDocument();
    expect(screen.getByText("Severance")).toBeInTheDocument();
    // The frozen tally line renders.
    expect(screen.getByText("Won the vote, 5 to 3")).toBeInTheDocument();
  });

  it("disables a proposal's vote button while its toggle is in flight", () => {
    const proposals = [
      makeProposal({
        id: "a",
        media: { id: "ma", title: "Arcane", type: "anime", posterUrl: null },
      }),
    ];
    mockUseQueue.mockReturnValue(result({ proposals, pendingVotes: new Set(["a"]) }));

    render(<UpNextQueue />);

    expect(screen.getByRole("button", { name: /Vote for Arcane/i })).toBeDisabled();
  });

  it("shows the empty state when nothing is scheduled or proposed", () => {
    mockUseQueue.mockReturnValue(result({ scheduled: null, proposals: [] }));

    render(<UpNextQueue />);

    expect(screen.getByText(/Nothing scheduled yet/i)).toBeInTheDocument();
  });

  it("renders NO DATE YET and a Set date button for a dateless scheduled pick", () => {
    const scheduled = makeProposal({
      id: "sched",
      status: "scheduled",
      scheduledDate: null,
    });
    mockUseQueue.mockReturnValue(result({ scheduled, proposals: [] }));

    render(<UpNextQueue />);

    expect(screen.getByText(/NO DATE YET/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Set date/i })).toBeInTheDocument();
  });

  it("renders a Change date button when the scheduled pick has a date", () => {
    const scheduled = makeProposal({
      id: "sched",
      status: "scheduled",
      scheduledDate: "2026-07-01",
    });
    mockUseQueue.mockReturnValue(result({ scheduled, proposals: [] }));

    render(<UpNextQueue />);

    expect(screen.getByRole("button", { name: /Change date/i })).toBeInTheDocument();
    expect(screen.queryByText(/NO DATE YET/i)).not.toBeInTheDocument();
  });

  it("removes a proposal after confirming in the dialog", async () => {
    const user = userEvent.setup();
    const removeProposal = vi.fn();
    const proposals = [
      makeProposal({
        id: "a",
        media: { id: "ma", title: "Arcane", type: "anime", posterUrl: null },
      }),
    ];
    mockUseQueue.mockReturnValue(result({ proposals, removeProposal }));

    render(<UpNextQueue />);

    // The row's remove control opens a confirm dialog.
    await user.click(screen.getByRole("button", { name: /Remove Arcane from the queue/i }));
    const dialog = screen.getByRole("dialog");
    // Confirming calls removeProposal with the proposal id.
    await user.click(within(dialog).getByRole("button", { name: /^Remove$/i }));

    expect(removeProposal).toHaveBeenCalledWith("a");
  });

  it("does not remove when the confirm dialog is cancelled", async () => {
    const user = userEvent.setup();
    const removeProposal = vi.fn();
    const proposals = [
      makeProposal({
        id: "a",
        media: { id: "ma", title: "Arcane", type: "anime", posterUrl: null },
      }),
    ];
    mockUseQueue.mockReturnValue(result({ proposals, removeProposal }));

    render(<UpNextQueue />);

    await user.click(screen.getByRole("button", { name: /Remove Arcane from the queue/i }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Cancel/i }));

    expect(removeProposal).not.toHaveBeenCalled();
  });

  it("sets a date on the scheduled pick via the schedule dialog", async () => {
    const user = userEvent.setup();
    const setScheduledDate = vi.fn();
    const scheduled = makeProposal({ id: "sched", status: "scheduled", scheduledDate: null });
    mockUseQueue.mockReturnValue(result({ scheduled, setScheduledDate }));

    render(<UpNextQueue />);

    // Open the schedule dialog from the scheduled card's date button.
    await user.click(screen.getByRole("button", { name: /Set date/i }));
    const dialog = screen.getByRole("dialog");

    // Pick a date and save.
    const input = within(dialog).getByLabelText(/date/i);
    await user.clear(input);
    await user.type(input, "2026-07-01");
    await user.click(within(dialog).getByRole("button", { name: /^Save$/i }));

    expect(setScheduledDate).toHaveBeenCalledWith("sched", "2026-07-01");
  });

  it("clears the date back to dateless via the schedule dialog", async () => {
    const user = userEvent.setup();
    const setScheduledDate = vi.fn();
    const scheduled = makeProposal({
      id: "sched",
      status: "scheduled",
      scheduledDate: "2026-07-01T00:00:00.000Z",
    });
    mockUseQueue.mockReturnValue(result({ scheduled, setScheduledDate }));

    render(<UpNextQueue />);

    await user.click(screen.getByRole("button", { name: /Change date/i }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Clear date/i }));

    expect(setScheduledDate).toHaveBeenCalledWith("sched", null);
  });
});
