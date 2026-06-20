/**
 * Queue read queries
 *
 * `getQueueState` is the single source of ranking/tie-break truth for the GET
 * route (and any server-side reader): it derives vote counts, ranks proposals
 * with `rankProposals`, and resolves `hasVoted` for the current user.
 */

import { db } from "@/lib/db";
import type { MediaType, QueueProposalStatus } from "@/lib/db/types";

import { rankProposals } from "./ranking";

export interface QueueProposer {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface QueueMedia {
  id: string;
  title: string;
  type: MediaType;
  posterUrl: string | null;
}

export interface QueueProposalView {
  id: string;
  status: QueueProposalStatus;
  scheduledDate: Date | null;
  proposedAt: Date;
  voteCount: number;
  hasVoted: boolean;
  media: QueueMedia;
  proposer: QueueProposer | null;
}

export interface QueueState {
  scheduled: QueueProposalView | null;
  proposals: QueueProposalView[];
}

interface ProposalRow {
  id: string;
  status: QueueProposalStatus;
  scheduled_date: Date | null;
  proposed_at: Date;
  voteCount: string | number | bigint;
  hasVoted: boolean;
  media_id: string;
  media_title: string;
  media_type: MediaType;
  media_poster_url: string | null;
  proposer_id: string | null;
  proposer_username: string | null;
  proposer_display_name: string | null;
  proposer_avatar_url: string | null;
}

function toView(row: ProposalRow): QueueProposalView {
  return {
    id: row.id,
    status: row.status,
    scheduledDate: row.scheduled_date,
    proposedAt: row.proposed_at,
    voteCount: Number(row.voteCount),
    hasVoted: row.hasVoted,
    media: {
      id: row.media_id,
      title: row.media_title,
      type: row.media_type,
      posterUrl: row.media_poster_url,
    },
    proposer:
      row.proposer_id === null
        ? null
        : {
            id: row.proposer_id,
            username: row.proposer_username ?? "",
            displayName: row.proposer_display_name,
            avatarUrl: row.proposer_avatar_url,
          },
  };
}

/**
 * Returns the scheduled pick (or `null`) and the ranked list of open proposals
 * for the queue, each enriched with media, proposer, derived `voteCount`, and
 * `hasVoted` for `currentUserId`. Watched (history) rows are excluded.
 */
export async function getQueueState(currentUserId: string): Promise<QueueState> {
  const rows = (await db
    .selectFrom("queue_proposals")
    .innerJoin("media", "media.id", "queue_proposals.media_id")
    .leftJoin("users", "users.id", "queue_proposals.proposed_by")
    .select((eb) => [
      "queue_proposals.id as id",
      "queue_proposals.status as status",
      "queue_proposals.scheduled_date as scheduled_date",
      "queue_proposals.proposed_at as proposed_at",
      "queue_proposals.media_id as media_id",
      "media.title as media_title",
      "media.type as media_type",
      "media.poster_url as media_poster_url",
      "users.id as proposer_id",
      "users.username as proposer_username",
      "users.display_name as proposer_display_name",
      "users.avatar_url as proposer_avatar_url",
      eb
        .selectFrom("queue_votes")
        .select((veb) => veb.fn.countAll().as("c"))
        .whereRef("queue_votes.proposal_id", "=", "queue_proposals.id")
        .as("voteCount"),
      eb
        .exists(
          eb
            .selectFrom("queue_votes")
            .select("queue_votes.id")
            .whereRef("queue_votes.proposal_id", "=", "queue_proposals.id")
            .where("queue_votes.user_id", "=", currentUserId),
        )
        .as("hasVoted"),
    ])
    .where("queue_proposals.status", "in", ["proposed", "scheduled"])
    // This cast is load-bearing: it must track the select list above field for
    // field. The aliases (incl. the `voteCount`/`hasVoted` correlated subqueries)
    // map onto ProposalRow exactly — keep them in sync if either side changes.
    .execute()) as ProposalRow[];

  const views = rows.map((row) => toView(row));

  const scheduled = views.find((v) => v.status === "scheduled") ?? null;
  const proposals = rankProposals(views.filter((v) => v.status === "proposed"));

  return { scheduled, proposals };
}
