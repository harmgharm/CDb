/**
 * SWR hook backing the dashboard group-queue section.
 *
 * Reads the canonical queue state from GET /api/queue — the single source of
 * ranking/tie-break truth (the server ranks; the client renders). Dates arrive
 * as ISO strings over JSON, so the client view types them as strings (the route
 * selects `Date`).
 *
 * Real-time (Ably subscription) and optimistic vote flips are intentionally NOT
 * here yet — they land in slice 3. For now a vote calls the API and revalidates.
 */

import { useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";
import type { MediaType } from "@/lib/db/types";

const DATELESS_LABEL = "NO DATE YET";

export interface QueueProposer {
  readonly id: string;
  readonly username: string;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
}

export interface QueueMedia {
  readonly id: string;
  readonly title: string;
  readonly type: MediaType;
  readonly posterUrl: string | null;
}

/** Client view of a proposal — dates are ISO strings (JSON-serialized). */
export interface QueueProposalView {
  readonly id: string;
  readonly status: "proposed" | "scheduled" | "watched";
  readonly scheduledDate: string | null;
  readonly proposedAt: string;
  readonly voteCount: number;
  readonly hasVoted: boolean;
  readonly wonVotes: number | null;
  readonly runnerUpVotes: number | null;
  readonly media: QueueMedia;
  readonly proposer: QueueProposer | null;
}

export interface QueueState {
  readonly scheduled: QueueProposalView | null;
  readonly proposals: readonly QueueProposalView[];
}

/**
 * The scheduled-card eyebrow date: the dateless sentinel when no date is set,
 * otherwise a "Wed · Jul 1" weekday-month-day label. Matched copy with the
 * sidebar Up Next card so the dateless state never reads as a bug.
 *
 * Input is the JSON-serialized `scheduled_date` — a Postgres `date` becomes a
 * server-local-midnight `Date`, so over the wire it's a full ISO timestamp
 * (e.g. "2026-07-01T00:00:00.000Z"), not a bare "2026-07-01". Formatting in UTC
 * is deliberate: on the UTC host (Vercel) local midnight is UTC midnight, so the
 * calendar day is preserved.
 */
export function formatScheduledDate(scheduledDate: string | null): string {
  if (scheduledDate === null) {
    return DATELESS_LABEL;
  }
  const date = new Date(scheduledDate);
  const weekday = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const monthDay = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `${weekday} · ${monthDay}`;
}

/** Contextual schedule button: "Set date" when dateless, else "Change date". */
export function scheduleButtonLabel(scheduledDate: string | null): string {
  return scheduledDate === null ? "Set date" : "Change date";
}

/**
 * The "Won the vote, X to Y" line for the scheduled card, from the frozen
 * promotion tally. Null when no tally was captured (e.g. a directly-seeded
 * scheduled pick that never went through a promotion).
 *
 * Equal tallies are phrased as a tie-break win: the oldest-proposal tie-break
 * can promote a pick with the same count as the runner-up, and "Won the vote,
 * 2 to 2" reads as a contradiction. (This line is dashboard-only; the sidebar
 * Up Next card never shows it, so there's no matched-copy obligation here.)
 */
export function wonVoteLine(tally: {
  wonVotes: number | null;
  runnerUpVotes: number | null;
}): string | null {
  if (tally.wonVotes === null || tally.runnerUpVotes === null) {
    return null;
  }
  // Promoted with no votes in play (0 to 0). This is the empty-slot bootstrap —
  // typically the literal first proposal, but also any later auto-fill where no
  // candidate had a vote. Either way there was no contest to "win", so frame it
  // as taking the slot rather than winning a vote. (The stored tally can't tell
  // "no runner-up" from "runner-up had 0 votes"; both read fine as this.)
  if (tally.wonVotes === 0 && tally.runnerUpVotes === 0) {
    return "First in the queue";
  }
  if (tally.wonVotes === tally.runnerUpVotes) {
    return `Won on the tie-break, ${String(tally.wonVotes)} each`;
  }
  return `Won the vote, ${String(tally.wonVotes)} to ${String(tally.runnerUpVotes)}`;
}

export interface UseQueueResult {
  readonly scheduled: QueueProposalView | null;
  readonly proposals: readonly QueueProposalView[];
  readonly isLoading: boolean;
  /** Proposal IDs with a vote toggle currently in flight (disable their button). */
  readonly pendingVotes: ReadonlySet<string>;
  /** Revalidate the queue (call after a vote/propose/schedule/delete write). */
  readonly refresh: () => Promise<unknown>;
  /**
   * Toggle the current user's vote on a proposal, then revalidate. `hasVoted` is
   * the current state, so the action knows which verb to send. Guarded against
   * concurrent toggles of the same proposal (the second call is a no-op) so a
   * stale `hasVoted` can't fire the wrong verb mid-flight. (Optimistic flip +
   * live Ably reconciliation arrive in slice 3; this just writes + refetches.)
   */
  readonly toggleVote: (proposalId: string, hasVoted: boolean) => Promise<void>;
}

const QUEUE_KEY = "/api/queue";

export function useQueue(): UseQueueResult {
  const { data, isLoading, mutate } = useSWR<QueueState>(QUEUE_KEY);
  const [pendingVotes, setPendingVotes] = useState<ReadonlySet<string>>(new Set());

  const toggleVote = async (proposalId: string, hasVoted: boolean): Promise<void> => {
    // Ignore a second toggle while one is already in flight for this proposal —
    // the in-flight request will resolve the state via revalidation.
    if (pendingVotes.has(proposalId)) {
      return;
    }
    setPendingVotes((previous) => new Set(previous).add(proposalId));

    try {
      const response = await fetchWithAuth(`/api/queue/${proposalId}/vote`, {
        method: hasVoted ? "DELETE" : "POST",
      });
      const json = (await response.json()) as ApiResponse<unknown>;
      if (json.error !== null) {
        toast.error("Couldn't update your vote");
      }
    } catch {
      // Network failure — fetchWithAuth rejects (HTTP errors don't).
      toast.error("Couldn't update your vote");
    } finally {
      // Always reconcile against server truth, then clear the pending flag.
      await mutate();
      setPendingVotes((previous) => {
        const next = new Set(previous);
        next.delete(proposalId);
        return next;
      });
    }
  };

  return {
    scheduled: data?.scheduled ?? null,
    proposals: data?.proposals ?? [],
    isLoading,
    pendingVotes,
    refresh: () => mutate(),
    toggleVote,
  };
}
