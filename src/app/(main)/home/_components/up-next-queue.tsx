"use client";

import { CalendarIcon, CheckIcon, PlusIcon, ThumbsUpIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ConfirmDeleteDialog } from "@/components/media/confirm-delete-dialog";
import { ImportMediaDialog } from "@/components/media/import-media-dialog";
import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { QueueProposalView, QueueProposer } from "@/hooks/use-queue";
import { formatScheduledDate, scheduleButtonLabel, useQueue, wonVoteLine } from "@/hooks/use-queue";

import { SetDateDialog } from "./set-date-dialog";

/**
 * A subtle remove control. On hover-capable devices (desktop) it stays hidden
 * until its row/card is hovered or the button is focused. On touch devices —
 * which have no hover, so group-hover would never fire and leave the control
 * permanently unreachable — it's always visible. Gated on the `hover` media
 * feature (not a width breakpoint) so it keys on actual input capability.
 */
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
      className={`text-muted-foreground hover:text-destructive rounded-md p-1 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-visible:opacity-100 ${className ?? ""}`}
    >
      <Trash2Icon className="size-3.5" />
    </button>
  );
}

function SectionShell({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold tracking-[0.12em] text-[var(--fg-dim)] uppercase">
          Up next &amp; the queue
        </span>
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>
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
  onRequestSchedule,
}: Readonly<{
  scheduled: QueueProposalView;
  onRequestRemove: (proposal: QueueProposalView) => void;
  onRequestSchedule: (proposal: QueueProposalView) => void;
}>) {
  const wonLine = wonVoteLine(scheduled);

  return (
    // Horizontal on desktop (tall poster left, content right — per the design
    // kit), stacked (poster on top) below lg where the two queue cards share one
    // narrow column. items-stretch lets the poster fill the card height on
    // desktop so the card never carries blank space.
    <div className="group bg-card relative flex min-w-0 flex-col gap-3.5 rounded-lg border p-3.5 lg:flex-row lg:items-stretch lg:gap-4">
      <RemoveButton
        title={scheduled.media.title}
        onRequestRemove={() => {
          onRequestRemove(scheduled);
        }}
        className="absolute top-2 right-2 z-10"
      />
      <Link
        href={`/database/${scheduled.media.id}`}
        aria-label={scheduled.media.title}
        className="relative shrink-0 lg:self-stretch"
      >
        {/* No `priority` here: this card renders only after the queue SWR data
            resolves (skeleton first), so the poster mounts post-hydration and
            next/image can't preload it — `priority` would be a silent no-op that
            misleadingly implies a preload. The intermittent dev LCP warning on
            this poster is a paint-timing race, not a fixable preload. */}
        <MediaPoster
          posterUrl={scheduled.media.posterUrl}
          title={scheduled.media.title}
          className="aspect-[2/3] w-[88px] lg:aspect-auto lg:h-full lg:w-[104px]"
        />
        <span className="bg-cdb-marquee text-cdb-ink absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium">
          <CheckIcon className="size-2.5" /> Locked in
        </span>
      </Link>
      {/* flex-1 makes the body fill the card height. The three header lines use a
          deliberate fixed gap (not justify-between, which spread them edge-to-edge
          across the whole column) so they read as separated but stay grouped near
          the top; mt-auto on the footer pins it to the bottom and absorbs the
          remaining slack. Top-heavy, matching the kit. */}
      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--fg-dim)] uppercase">
          Scheduled · {formatScheduledDate(scheduled.scheduledDate)}
        </p>
        <h3 className="font-display truncate text-[28px] leading-[1.05] font-normal tracking-[-0.02em]">
          <Link
            href={`/database/${scheduled.media.id}`}
            className="hover:text-cdb-marquee-text transition-colors"
          >
            {scheduled.media.title}
          </Link>
        </h3>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <MediaTypeBadge type={scheduled.media.type} />
          <span>
            · Proposed by <b className="text-foreground">{proposerName(scheduled.proposer)}</b>
          </span>
        </div>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-2.5">
          {wonLine !== null && (
            <span className="text-cdb-marquee-text inline-flex items-center gap-1.5 text-xs">
              <ThumbsUpIcon className="size-3" /> {wonLine}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              onRequestSchedule(scheduled);
            }}
            className="hover:border-cdb-marquee/55 inline-flex h-[30px] items-center gap-1.5 rounded-md border border-[var(--border-strong)] px-3 text-[13px] transition-colors hover:bg-[var(--bg-elev-2)]"
          >
            <CalendarIcon className="size-3.5" /> {scheduleButtonLabel(scheduled.scheduledDate)}
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
      <Link
        href={`/database/${proposal.media.id}`}
        className="group/row flex min-w-0 flex-1 items-center gap-3"
      >
        <MediaPoster
          posterUrl={proposal.media.posterUrl}
          title={proposal.media.title}
          className="aspect-[2/3] w-10 shrink-0"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="group-hover/row:text-cdb-marquee-text truncate text-sm font-medium transition-colors">
            {proposal.media.title}
          </div>
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
      </Link>
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

function EmptyState({ onPropose }: Readonly<{ onPropose: () => void }>) {
  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-lg border p-8 text-center">
      <p className="text-muted-foreground text-sm">Nothing scheduled yet, propose something.</p>
      <button
        type="button"
        onClick={onPropose}
        className="bg-cdb-marquee text-cdb-ink inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium"
      >
        <PlusIcon className="size-3.5" /> Propose a title
      </button>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
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
    setScheduledDate,
    refresh,
  } = useQueue();
  const [toRemove, setToRemove] = useState<QueueProposalView | null>(null);
  const [toSchedule, setToSchedule] = useState<QueueProposalView | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const openImport = (): void => {
    setImportOpen(true);
  };

  const handleToggleVote = (proposalId: string, hasVoted: boolean): void => {
    void toggleVote(proposalId, hasVoted);
  };

  const confirmRemove = (): void => {
    if (toRemove === null) return;
    void removeProposal(toRemove.id);
    setToRemove(null);
  };

  const saveScheduledDate = (date: string | null): void => {
    if (toSchedule === null) return;
    void setScheduledDate(toSchedule.id, date);
  };

  // Loading and fully-empty are body-only variants; the shell + the dialogs
  // (which any state can open) render once below, so there's a single mount of
  // each dialog regardless of which body shows.
  const isEmpty = scheduled === null && proposals.length === 0;

  let body: React.ReactNode;
  if (isLoading) {
    body = <QueueSkeleton />;
  } else if (isEmpty) {
    body = <EmptyState onPropose={openImport} />;
  } else {
    body = (
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        {scheduled === null ? (
          <EmptyState onPropose={openImport} />
        ) : (
          <ScheduledCard
            scheduled={scheduled}
            onRequestRemove={setToRemove}
            onRequestSchedule={setToSchedule}
          />
        )}

        <div className="bg-card flex flex-col rounded-lg border p-3.5">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-display text-lg font-normal">Up for the vote</h3>
            <button
              type="button"
              onClick={openImport}
              className="text-cdb-marquee inline-flex items-center gap-1 text-xs font-medium"
            >
              <PlusIcon className="size-3" /> Propose a title
            </button>
          </div>
          {proposals.length === 0 ? (
            // Reserve the same ~4-row height the populated list locks to (below),
            // so a lone scheduled pick with no vote proposals doesn't collapse
            // this card — and, via the grid's stretch, the scheduled card beside
            // it — back to the old short layout. Both cards stay tall as soon as
            // anything is in the queue, per the design kit.
            <p className="text-muted-foreground min-h-[19.5rem] py-4 text-sm">
              Nothing up for the vote yet. Propose a title to get the next pick going.
            </p>
          ) : (
            // Fix the vote list at exactly ~4 rows tall (each VoteRow is a 60px
            // poster + py-2 ≈ 76px). min-h reserves the full 4-row height so 1–3
            // proposals don't shrink the card and the 4th fills the reserved space
            // without growing it; max-h caps it so the 5th proposal onward scrolls
            // *within* this box. Both cards stay locked to this height (per the
            // design kit) — the scheduled card beside it never extends or leaves
            // blank space regardless of proposal count.
            <div className="divide-border -mr-1 flex max-h-[19.5rem] min-h-[19.5rem] flex-col divide-y overflow-y-auto pr-1">
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
    );
  }

  return (
    <SectionShell>
      {body}

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
        pendingLabel="Removing..."
        isDeleting={toRemove !== null && pendingRemovals.has(toRemove.id)}
        onConfirm={confirmRemove}
      />

      <SetDateDialog
        key={toSchedule?.id ?? "none"}
        open={toSchedule !== null}
        onOpenChange={(open) => {
          if (!open) setToSchedule(null);
        }}
        mediaTitle={toSchedule?.media.title ?? ""}
        currentDate={toSchedule?.scheduledDate ?? null}
        onSave={saveScheduledDate}
      />

      <ImportMediaDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => void refresh()}
      />
    </SectionShell>
  );
}
