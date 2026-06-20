"use client";

import { CalendarIcon, CheckIcon, PlusIcon, ThumbsUpIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { ConfirmDeleteDialog } from "@/components/media/confirm-delete-dialog";
import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { QueueProposalView, QueueProposer } from "@/hooks/use-queue";
import { formatScheduledDate, scheduleButtonLabel, useQueue, wonVoteLine } from "@/hooks/use-queue";

/** A subtle remove control that surfaces on hover/focus of its row or card. */
function RemoveButton({
  title,
  onRequestRemove,
  className,
}: Readonly<{ title: string; onRequestRemove: () => void; className?: string }>) {
  return (
    <button
      type="button"
      aria-label={`Remove ${title} from the queue`}
      onClick={onRequestRemove}
      className={`text-muted-foreground hover:text-destructive rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 ${className ?? ""}`}
    >
      <Trash2Icon className="size-3.5" />
    </button>
  );
}

function SectionShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <section className="flex flex-col gap-3.5">
      <p className="text-xs font-semibold tracking-[0.12em] text-[var(--fg-dim)] uppercase">
        Up next &amp; the queue
      </p>
      {children}
    </section>
  );
}

function proposerInitials(proposer: QueueProposer): string {
  const display =
    proposer.displayName !== null && proposer.displayName.length > 0
      ? proposer.displayName
      : proposer.username;
  return display
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function proposerName(proposer: QueueProposer | null): string {
  if (proposer === null) return "someone";
  return proposer.displayName !== null && proposer.displayName.length > 0
    ? proposer.displayName
    : proposer.username;
}

function ScheduledCard({
  scheduled,
  onRequestRemove,
}: Readonly<{
  scheduled: QueueProposalView;
  onRequestRemove: (proposal: QueueProposalView) => void;
}>) {
  const wonLine = wonVoteLine(scheduled);

  return (
    <div className="group bg-card relative flex flex-col gap-3.5 rounded-lg border p-3.5">
      <RemoveButton
        title={scheduled.media.title}
        onRequestRemove={() => {
          onRequestRemove(scheduled);
        }}
        className="absolute top-2 right-2"
      />
      <div className="relative shrink-0">
        <MediaPoster
          posterUrl={scheduled.media.posterUrl}
          title={scheduled.media.title}
          className="aspect-[2/3] w-[88px]"
          priority
        />
        <span className="bg-cdb-marquee text-cdb-ink absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
          <CheckIcon className="size-2.5" /> Locked in
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--fg-dim)] uppercase">
          Scheduled · {formatScheduledDate(scheduled.scheduledDate)}
        </p>
        <h3 className="font-display truncate text-[22px] leading-none font-normal tracking-[-0.015em]">
          {scheduled.media.title}
        </h3>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <MediaTypeBadge type={scheduled.media.type} />
          <span>
            · Proposed by <b className="text-foreground">{proposerName(scheduled.proposer)}</b>
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          {wonLine !== null && (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <ThumbsUpIcon className="size-3" /> {wonLine}
            </span>
          )}
          <button
            type="button"
            className="hover:border-cdb-marquee/55 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors"
          >
            <CalendarIcon className="size-3" /> {scheduleButtonLabel(scheduled.scheduledDate)}
          </button>
        </div>
      </div>
    </div>
  );
}

function VoteRow({
  proposal,
  rank,
  isVoting,
  onToggleVote,
  onRequestRemove,
}: Readonly<{
  proposal: QueueProposalView;
  rank: number;
  isVoting: boolean;
  onToggleVote: (proposalId: string, hasVoted: boolean) => void;
  onRequestRemove: (proposal: QueueProposalView) => void;
}>) {
  return (
    <div className="group flex items-center gap-3 py-2">
      <span className="text-muted-foreground w-4 shrink-0 text-center font-mono text-sm">
        {rank}
      </span>
      <MediaPoster
        posterUrl={proposal.media.posterUrl}
        title={proposal.media.title}
        className="aspect-[2/3] w-10 shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="truncate text-sm font-medium">{proposal.media.title}</div>
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <MediaTypeBadge type={proposal.media.type} />
          {proposal.proposer !== null && (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden>·</span>
              <Avatar size="sm">
                <AvatarImage src={proposal.proposer.avatarUrl ?? undefined} alt="" />
                <AvatarFallback className="text-[9px]">
                  {proposerInitials(proposal.proposer)}
                </AvatarFallback>
              </Avatar>
              {proposerName(proposal.proposer)}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        disabled={isVoting}
        aria-pressed={proposal.hasVoted}
        aria-label={`${proposal.hasVoted ? "Remove vote from" : "Vote for"} ${proposal.media.title}`}
        onClick={() => {
          onToggleVote(proposal.id, proposal.hasVoted);
        }}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors disabled:opacity-60 ${
          proposal.hasVoted
            ? "border-cdb-marquee/55 bg-cdb-marquee/10 text-cdb-marquee"
            : "hover:border-cdb-marquee/55"
        }`}
      >
        <ThumbsUpIcon className="size-3.5" />
        <span className="tabular-nums">{proposal.voteCount}</span>
      </button>
      <RemoveButton
        title={proposal.media.title}
        onRequestRemove={() => {
          onRequestRemove(proposal);
        }}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-lg border p-8 text-center">
      <p className="text-muted-foreground text-sm">Nothing scheduled yet, propose something.</p>
      <button
        type="button"
        className="bg-cdb-marquee text-cdb-ink inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
      >
        <PlusIcon className="size-3.5" /> Propose a title
      </button>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}

export function UpNextQueue() {
  const {
    scheduled,
    proposals,
    isLoading,
    pendingVotes,
    toggleVote,
    pendingRemovals,
    removeProposal,
  } = useQueue();
  const [toRemove, setToRemove] = useState<QueueProposalView | null>(null);

  if (isLoading) {
    return (
      <SectionShell>
        <QueueSkeleton />
      </SectionShell>
    );
  }

  if (scheduled === null && proposals.length === 0) {
    return (
      <SectionShell>
        <EmptyState />
      </SectionShell>
    );
  }

  const handleToggleVote = (proposalId: string, hasVoted: boolean): void => {
    void toggleVote(proposalId, hasVoted);
  };

  const confirmRemove = (): void => {
    if (toRemove === null) return;
    void removeProposal(toRemove.id);
    setToRemove(null);
  };

  return (
    <SectionShell>
      <div className="grid gap-4 lg:grid-cols-2">
        {scheduled === null ? (
          <EmptyState />
        ) : (
          <ScheduledCard scheduled={scheduled} onRequestRemove={setToRemove} />
        )}

        <div className="bg-card flex flex-col rounded-lg border p-3.5">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-display text-lg font-normal">Up for the vote</h3>
            <button
              type="button"
              className="text-cdb-marquee inline-flex items-center gap-1 text-xs font-medium"
            >
              <PlusIcon className="size-3" /> Propose a title
            </button>
          </div>
          {proposals.length === 0 ? (
            <p className="text-muted-foreground py-4 text-sm">
              Nothing up for the vote yet. Propose a title to get the next pick going.
            </p>
          ) : (
            // Cap the visible height so a long queue scrolls *within* this box
            // rather than pushing the dashboard down. ~6 rows before scrolling.
            <div className="divide-border -mr-1 flex max-h-[420px] flex-col divide-y overflow-y-auto pr-1">
              {proposals.map((proposal, index) => (
                <VoteRow
                  key={proposal.id}
                  proposal={proposal}
                  rank={index + 1}
                  isVoting={pendingVotes.has(proposal.id)}
                  onToggleVote={handleToggleVote}
                  onRequestRemove={setToRemove}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDeleteDialog
        open={toRemove !== null}
        onOpenChange={(open) => {
          if (!open) setToRemove(null);
        }}
        title="Remove from queue?"
        description={
          toRemove === null
            ? ""
            : `Remove "${toRemove.media.title}" from the queue? This also clears its votes.`
        }
        confirmLabel="Remove"
        pendingLabel="Removing…"
        isDeleting={toRemove !== null && pendingRemovals.has(toRemove.id)}
        onConfirm={confirmRemove}
      />
    </SectionShell>
  );
}
