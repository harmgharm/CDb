/**
 * Group queue real-time event names + payload types (Ably `group:queue`).
 *
 * Shared by the server (which publishes via `publishToQueue` /
 * `publishToQueueAsync`) and the client (`useQueue` subscribes via `useChannel`)
 * so the event names never drift between the two sides. No Ably client lives here
 * — just the contract.
 *
 * Payloads are deliberately minimal: every event is a "something changed,
 * refetch" trigger that makes `useQueue` revalidate the canonical GET, which is
 * the single source of ranking/tie-break truth. Clients never patch their cache
 * from these payloads (the one exception — the actor's own optimistic vote flip —
 * happens before the broadcast, in `toggleVote`).
 */

/** Group-wide queue channel — everyone subscribes, the server publishes. */
export const QUEUE_CHANNEL = "group:queue";

export const QUEUE_EVENTS = {
  proposed: "queue:proposed",
  voted: "queue:voted",
  advanced: "queue:advanced",
  scheduled: "queue:scheduled",
  removed: "queue:removed",
} as const;

export type QueueEventName = (typeof QUEUE_EVENTS)[keyof typeof QUEUE_EVENTS];

export interface QueueProposedEvent {
  proposalId: string;
  mediaId: string;
}

export interface QueueVotedEvent {
  proposalId: string;
  voteCount: number;
}

export interface QueueAdvancedEvent {
  /** The proposal just marked watched. */
  watchedId: string;
  /** The proposal promoted into the scheduled slot, or null if none remained. */
  scheduledId: string | null;
}

export interface QueueScheduledEvent {
  proposalId: string;
  /** The new date as "YYYY-MM-DD", or null when cleared back to dateless. */
  scheduledDate: string | null;
}

export interface QueueRemovedEvent {
  proposalId: string;
}
