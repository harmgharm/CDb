/**
 * SWR hook backing the sidebar Up Next card.
 *
 * Source priority (first match wins):
 *   1. "queue"       — the group's scheduled queue pick, if any
 *   2. "in-progress" — top watching entry from the current user's watchlist
 *   3. "watchlist"   — top planning entry from the current user's watchlist
 *   4. null          — nothing scheduled and both watchlist lists empty
 *
 * The queue source reuses /api/queue via `useQueue()`; the watchlist sources
 * reuse /api/watchlist. No new API route. Live updates for the queue source are
 * free: the `group:queue` Ably subscription lives in QueueListener (app-wide),
 * which revalidates the queue SWR key, so the sidebar reacts without any extra
 * wiring here.
 */

import useSWR from "swr";

import { useAuth } from "@/components/providers/auth-provider";
import { formatScheduledDate, type QueueProposalView, useQueue } from "@/hooks/use-queue";
import type { MediaType, WatchlistStatus } from "@/lib/db/types";
import type { WatchlistItem, WatchlistResponse } from "@/types/watchlist-responses";

export type UpNextSource = "queue" | "in-progress" | "watchlist";

export interface UpNextItem {
  readonly mediaId: string | null;
  readonly title: string;
  readonly posterUrl: string | null;
  readonly mediaType: MediaType;
  readonly href: string;
  /** Queue source only: the fully-formed eyebrow (`UP NEXT · {date | NO DATE YET}`). */
  readonly eyebrow?: string;
  /** Queue source only: the proposer's display name for the "Proposed by" line. */
  readonly proposedBy?: string;
}

export interface UpNextSelection {
  readonly data: UpNextItem | null;
  readonly source: UpNextSource | null;
}

export interface UseUpNextResult extends UpNextSelection {
  readonly isLoading: boolean;
}

function buildKey(userId: string, status: WatchlistStatus): string {
  const params = new URLSearchParams({ userId, status, limit: "1" });
  return `/api/watchlist?${params.toString()}`;
}

/**
 * The link target for a watchlist entry: its media detail page when imported,
 * otherwise the current user's own profile with the Watchlist tab open (an
 * unimported entry has no detail page — the personal watchlist lives in a tab on
 * `/users/[id]`). Falls back to the roster if the user id is somehow unknown.
 */
function watchlistHref(entry: WatchlistItem, userId: string | undefined): string {
  if (entry.media_id !== null) {
    return `/database/${entry.media_id}`;
  }
  return userId === undefined ? "/users" : `/users/${userId}?tab=watchlist`;
}

function toUpNextItem(entry: WatchlistItem, userId: string | undefined): UpNextItem {
  return {
    mediaId: entry.media_id,
    title: entry.title,
    posterUrl: entry.poster_url,
    mediaType: entry.media_type,
    href: watchlistHref(entry, userId),
  };
}

/** The proposer's display name, mirroring the dashboard's "Proposed by" copy. */
function proposerName(proposer: QueueProposalView["proposer"]): string {
  if (proposer === null) {
    return "someone";
  }
  return proposer.displayName !== null && proposer.displayName.length > 0
    ? proposer.displayName
    : proposer.username;
}

function toQueueUpNextItem(scheduled: QueueProposalView): UpNextItem {
  return {
    mediaId: scheduled.media.id,
    title: scheduled.media.title,
    posterUrl: scheduled.media.posterUrl,
    mediaType: scheduled.media.type,
    href: `/database/${scheduled.media.id}`,
    // Reuse the dashboard's date formatter so the date label and the NO DATE YET
    // sentinel are identical to the scheduled card (matched copy, spec §7c).
    eyebrow: `UP NEXT · ${formatScheduledDate(scheduled.scheduledDate)}`,
    proposedBy: proposerName(scheduled.proposer),
  };
}

/**
 * Pure core: pick the highest-priority Up Next source. The scheduled queue pick
 * wins when present, then the top watching entry, then the top planning entry.
 * Extracted from the hook so the priority order is testable without SWR or React.
 */
/** Inputs to the Up Next priority pick: the queue's scheduled slot, the user's
 *  top watching/planning watchlist entries, and the user id (for href building). */
export interface UpNextSources {
  readonly scheduled: QueueProposalView | null;
  readonly watchingItem: WatchlistItem | undefined;
  readonly planningItem: WatchlistItem | undefined;
  readonly userId: string | undefined;
}

export function selectUpNext(sources: UpNextSources): UpNextSelection {
  const { scheduled, watchingItem, planningItem, userId } = sources;
  if (scheduled !== null) {
    return { data: toQueueUpNextItem(scheduled), source: "queue" };
  }
  if (watchingItem !== undefined) {
    return { data: toUpNextItem(watchingItem, userId), source: "in-progress" };
  }
  if (planningItem !== undefined) {
    return { data: toUpNextItem(planningItem, userId), source: "watchlist" };
  }
  return { data: null, source: null };
}

/** Whether each of the three Up Next sources is still loading its first response. */
export interface UpNextLoading {
  readonly queueLoading: boolean;
  readonly watchingLoading: boolean;
  readonly planningLoading: boolean;
}

/**
 * Fold a `selectUpNext` result together with the three sources' loading flags
 * into the hook's final shape, guarding the priority order against a load race.
 *
 * The queue is the top priority but resolves independently of the watchlist
 * requests. While the queue is still loading, `selectUpNext` sees a `null`
 * scheduled pick and may have already picked a watchlist source — committing to
 * it now would flash that item, then "pop" to the queue once it resolves with a
 * higher-priority scheduled pick. So while the queue is loading, report loading
 * rather than trust a watchlist selection. (A queue source can never be selected
 * while `queueLoading` is true — SWR has no data yet — so this never delays a
 * real queue pick.) Once the queue has settled, a resolved selection is final;
 * otherwise we keep loading until the watchlist requests settle too.
 *
 * Pure (no SWR/React) so the race is testable.
 */
export function resolveUpNext(selection: UpNextSelection, loading: UpNextLoading): UseUpNextResult {
  if (!loading.queueLoading && selection.source !== null) {
    return { ...selection, isLoading: false };
  }
  const isLoading = loading.queueLoading || loading.watchingLoading || loading.planningLoading;
  return { data: null, source: null, isLoading };
}

export function useUpNext(): UseUpNextResult {
  const { user } = useAuth();
  const userId = user?.id;

  const { scheduled, isLoading: queueLoading } = useQueue();
  const watching = useSWR<WatchlistResponse>(
    userId === undefined ? null : buildKey(userId, "watching"),
  );
  const planning = useSWR<WatchlistResponse>(
    userId === undefined ? null : buildKey(userId, "planning"),
  );

  if (userId === undefined) {
    return { data: null, source: null, isLoading: false };
  }

  const selection = selectUpNext({
    scheduled,
    watchingItem: watching.data?.items[0],
    planningItem: planning.data?.items[0],
    userId,
  });
  return resolveUpNext(selection, {
    queueLoading,
    watchingLoading: watching.isLoading,
    planningLoading: planning.isLoading,
  });
}
