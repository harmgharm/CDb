/**
 * SWR hook backing the dashboard group-queue section.
 *
 * Reads the canonical queue state from GET /api/queue — the single source of
 * ranking/tie-break truth (the server ranks; the client renders). Dates arrive
 * as ISO strings over JSON, so the client view types them as strings (the route
 * selects `Date`).
 *
 * Real-time (slice 3): the `group:queue` Ably subscription is NOT here — it
 * lives in `QueueListener` (ably-provider.tsx), which revalidates this SWR key
 * on any event. (`useChannel` throws during the static prerender of /home and
 * when logged out, where no Ably client is in context, so the subscription must
 * stay inside the browser-only ChannelProvider.) Payloads are "something
 * changed, refetch" triggers, never patched into the cache — ranking truth lives
 * only in the GET. The one exception is the actor's own vote, which this hook
 * flips optimistically (`applyVoteFlip`) for an instant thumbs-up; the broadcast
 * then reconciles.
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
 * The value for a native `<input type="date">` (YYYY-MM-DD) from a scheduled
 * date, or "" when dateless. Both the ISO-timestamp wire shape
 * ("2026-07-01T00:00:00.000Z") and a bare date already start with the date part,
 * so the first 10 chars are the date — no `Date` round-trip (and no TZ pitfall).
 */
export function toDateInputValue(scheduledDate: string | null): string {
  return scheduledDate === null ? "" : scheduledDate.slice(0, 10);
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

/**
 * Re-rank the vote list the same way the server does: votes DESC, then oldest
 * proposal (`proposed_at` ASC) as the tie-break. `proposedAt` is an ISO-8601
 * string, whose lexicographic order matches chronological order, so it can be
 * compared as a string with no `Date` round-trip. Returns a new array.
 */
function rankProposalViews(proposals: readonly QueueProposalView[]): readonly QueueProposalView[] {
  return proposals.toSorted((a, b) => {
    if (a.voteCount !== b.voteCount) {
      return b.voteCount - a.voteCount;
    }
    return a.proposedAt.localeCompare(b.proposedAt);
  });
}

/**
 * Optimistically apply the actor's own vote toggle to the cached queue state:
 * flip `hasVoted` on the target proposal and nudge its `voteCount` by ±1, then
 * re-rank the vote list (a vote can reorder it). The scheduled pick stays in its
 * slot — its count updates in place but it never moves into the list. Returns a
 * new state (no mutation); `undefined` in -> `undefined` out (nothing to flip),
 * and an unknown id leaves the state unchanged. The Ably broadcast then
 * reconciles every client (including this one) against server truth.
 */
export function applyVoteFlip(
  state: QueueState | undefined,
  proposalId: string,
  nextHasVoted: boolean,
): QueueState | undefined {
  if (state === undefined) {
    return undefined;
  }

  const flip = (proposal: QueueProposalView): QueueProposalView => {
    if (proposal.id !== proposalId) {
      return proposal;
    }
    const delta = nextHasVoted ? 1 : -1;
    return {
      ...proposal,
      hasVoted: nextHasVoted,
      voteCount: Math.max(0, proposal.voteCount + delta),
    };
  };

  const scheduled = state.scheduled === null ? null : flip(state.scheduled);
  const proposals = rankProposalViews(state.proposals.map((p) => flip(p)));

  return { scheduled, proposals };
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
  /** Proposal IDs with a removal currently in flight (disable their control). */
  readonly pendingRemovals: ReadonlySet<string>;
  /**
   * Remove a proposal from the queue (`DELETE /api/queue/[id]`), then revalidate.
   * Guarded against concurrent removals of the same proposal. Removing the
   * scheduled pick is the documented escape hatch — the next proposal auto-fills.
   */
  readonly removeProposal: (proposalId: string) => Promise<void>;
  /**
   * Set or clear the scheduled pick's date (`PATCH /api/queue/[id]/schedule`),
   * then revalidate. `date` is "YYYY-MM-DD" to set, or `null` to clear back to
   * the dateless "NO DATE YET" state.
   */
  readonly setScheduledDate: (proposalId: string, date: string | null) => Promise<void>;
}

/** The SWR key for the canonical queue state — shared with QueueListener. */
export const QUEUE_KEY = "/api/queue";

export function useQueue(): UseQueueResult {
  const { data, isLoading, mutate } = useSWR<QueueState>(QUEUE_KEY);
  const [pendingVotes, setPendingVotes] = useState<ReadonlySet<string>>(new Set());
  const [pendingRemovals, setPendingRemovals] = useState<ReadonlySet<string>>(new Set());

  // Real-time note: the `group:queue` Ably subscription is NOT here. `useChannel`
  // throws when no ChannelProvider/Ably client is in context, which happens
  // during the static prerender of `/home` (and when logged out, where
  // AblyProvider renders children with no provider). So the subscription lives in
  // QueueListener, rendered only inside the browser-only ChannelProvider, and it
  // revalidates this SWR key by key — exactly the NotificationListener pattern.

  const toggleVote = async (proposalId: string, hasVoted: boolean): Promise<void> => {
    // Ignore a second toggle while one is already in flight for this proposal —
    // the in-flight request will resolve the state via revalidation.
    if (pendingVotes.has(proposalId)) {
      return;
    }
    setPendingVotes((previous) => new Set(previous).add(proposalId));

    // Optimistically flip the actor's own vote for an instant thumbs-up (and a
    // possible re-rank). No revalidation yet — the fetch's `finally` reconciles
    // against server truth, and the broadcast reconciles every other client.
    void mutate((current) => applyVoteFlip(current, proposalId, !hasVoted), { revalidate: false });

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
      // Always reconcile against server truth (rolls back a failed optimistic
      // flip), then clear the pending flag.
      await mutate();
      setPendingVotes((previous) => {
        const next = new Set(previous);
        next.delete(proposalId);
        return next;
      });
    }
  };

  const removeProposal = async (proposalId: string): Promise<void> => {
    if (pendingRemovals.has(proposalId)) {
      return;
    }
    setPendingRemovals((previous) => new Set(previous).add(proposalId));

    try {
      const response = await fetchWithAuth(`/api/queue/${proposalId}`, { method: "DELETE" });
      const json = (await response.json()) as ApiResponse<unknown>;
      if (json.error !== null) {
        toast.error("Couldn't remove the proposal");
      }
    } catch {
      toast.error("Couldn't remove the proposal");
    } finally {
      await mutate();
      setPendingRemovals((previous) => {
        const next = new Set(previous);
        next.delete(proposalId);
        return next;
      });
    }
  };

  const setScheduledDate = async (proposalId: string, date: string | null): Promise<void> => {
    try {
      const response = await fetchWithAuth(`/api/queue/${proposalId}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate: date }),
      });
      const json = (await response.json()) as ApiResponse<unknown>;
      if (json.error !== null) {
        toast.error("Couldn't update the date");
      }
    } catch {
      toast.error("Couldn't update the date");
    } finally {
      await mutate();
    }
  };

  return {
    scheduled: data?.scheduled ?? null,
    proposals: data?.proposals ?? [],
    isLoading,
    pendingVotes,
    refresh: () => mutate(),
    toggleVote,
    pendingRemovals,
    removeProposal,
    setScheduledDate,
  };
}

/** Outcome of a propose call — distinguishes a fresh create from a dedup no-op. */
export interface ProposeOutcome {
  /** True when the proposal already existed (dedup no-op), false on create. */
  readonly alreadyProposed: boolean;
}

/**
 * One-shot action hook for proposing a title to the group queue by `mediaId`
 * (`POST /api/queue/propose`). Returns the dedup-aware outcome so callers can
 * tell "added to the queue" from "already in the queue", or `null` on failure.
 * Mirrors `useMediaImport`'s shape (isPending + error + action).
 */
export function useProposeToQueue() {
  const [isProposing, setIsProposing] = useState(false);

  const propose = async (mediaId: string): Promise<ProposeOutcome | null> => {
    setIsProposing(true);
    try {
      const response = await fetchWithAuth("/api/queue/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId }),
      });
      const json = (await response.json()) as ApiResponse<{ alreadyProposed: boolean }>;
      if (json.error !== null) {
        return null;
      }
      return { alreadyProposed: json.data.alreadyProposed };
    } catch {
      return null;
    } finally {
      setIsProposing(false);
    }
  };

  return { isProposing, propose };
}
