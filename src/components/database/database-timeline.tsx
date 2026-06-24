"use client";

import { StarIcon } from "lucide-react";
import Link from "next/link";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { TimelineAttendee, TimelineEntry } from "@/types/timeline-responses";

const MAX_AVATARS = 5;

function attendeeName(attendee: TimelineAttendee): string {
  return attendee.displayName ?? attendee.username;
}

function attendeeInitials(attendee: TimelineAttendee): string {
  return attendeeName(attendee)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** "Jun 7" from a YYYY-MM-DD string, in UTC to avoid an off-by-one day shift. */
function shortDate(dateWatched: string | null): string {
  if (dateWatched === null) {
    return "";
  }
  return new Date(`${dateWatched}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function MetaSeparator() {
  return <span className="text-[var(--fg-dim)]">·</span>;
}

function AttendeeRow({
  attendees,
  attendeeCount,
  groupSize,
}: Readonly<{ attendees: readonly TimelineAttendee[]; attendeeCount: number; groupSize: number }>) {
  if (attendeeCount === 0) {
    return null;
  }
  const shown = attendees.slice(0, MAX_AVATARS);
  const overflow = attendees.length - shown.length;

  return (
    <span className="inline-flex items-center gap-2">
      <AvatarGroup data-size="sm">
        {shown.map((attendee) => (
          <Avatar key={attendee.id} size="sm" title={attendeeName(attendee)}>
            {attendee.avatarUrl !== null && (
              <AvatarImage src={attendee.avatarUrl} alt={attendeeName(attendee)} />
            )}
            <AvatarFallback>{attendeeInitials(attendee)}</AvatarFallback>
          </Avatar>
        ))}
        {overflow > 0 && <AvatarGroupCount>+{overflow}</AvatarGroupCount>}
      </AvatarGroup>
      <span>
        {attendeeCount} of {groupSize} showed
      </span>
    </span>
  );
}

function TimelineCard({ entry, groupSize }: Readonly<{ entry: TimelineEntry; groupSize: number }>) {
  return (
    <Link
      href={`/database/${entry.mediaId}`}
      className="bg-card hover:border-cdb-marquee/45 flex gap-4 rounded-lg border p-4 transition-colors hover:translate-x-0.5 sm:p-5"
    >
      <MediaPoster
        posterUrl={entry.posterUrl}
        title={entry.title}
        className="aspect-[2/3] w-16 shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display min-w-0 flex-1 text-[19px] leading-tight font-normal tracking-[-0.015em]">
            {entry.title}
          </h3>
          {entry.rating !== null && (
            <span className="font-display text-cdb-star inline-flex shrink-0 items-center gap-1 text-base tabular-nums">
              <StarIcon className="size-3 fill-amber-500 text-amber-500" />
              {entry.rating.average.toFixed(1)}
            </span>
          )}
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
          <MediaTypeBadge type={entry.type} />
          {entry.pickerName !== null && (
            <>
              <MetaSeparator />
              <span>
                Picked by <span className="text-foreground font-medium">{entry.pickerName}</span>
              </span>
            </>
          )}
          {entry.attendeeCount > 0 && (
            <>
              <MetaSeparator />
              <AttendeeRow
                attendees={entry.attendees}
                attendeeCount={entry.attendeeCount}
                groupSize={groupSize}
              />
            </>
          )}
        </div>
        {entry.take !== null && (
          <p className="font-display text-foreground text-sm leading-snug text-pretty italic">
            &ldquo;{entry.take.text}&rdquo;
            {entry.take.by !== null && (
              <span className="text-cdb-marquee ml-2.5 align-baseline font-sans text-[10px] font-semibold tracking-[0.08em] whitespace-nowrap uppercase not-italic">
                {entry.take.by}
              </span>
            )}
          </p>
        )}
      </div>
    </Link>
  );
}

function TimelineRow({
  entry,
  groupSize,
  isLast,
}: Readonly<{ entry: TimelineEntry; groupSize: number; isLast: boolean }>) {
  return (
    <div className="grid grid-cols-[54px_minmax(0,1fr)] gap-3.5 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-[22px]">
      <div className="pt-3.5 text-right">
        <div className="font-display text-cdb-marquee text-[19px] leading-none tracking-[-0.01em]">
          {entry.week === null ? "·" : `Wk ${String(entry.week)}`}
        </div>
        <div className="text-muted-foreground mt-1.5 text-[11px] tracking-[0.03em]">
          {shortDate(entry.dateWatched)}
        </div>
      </div>
      {/* pb sets the gap to the next card. The last entry needs almost none.
          Driven by position in the list, not CSS :last-child — every rail body
          is structurally the last child of its own row, so `last:` would match
          all of them and collapse every gap. */}
      <div className={`relative border-l-2 pl-5 sm:pl-7 ${isLast ? "pb-2" : "pb-6"}`}>
        <span className="bg-background border-cdb-marquee absolute top-[22px] -left-[7px] size-[13px] rounded-full border-2 shadow-[0_0_0_4px_var(--background),0_0_14px_color-mix(in_oklch,var(--cdb-marquee)_35%,transparent)]" />
        <TimelineCard entry={entry} groupSize={groupSize} />
      </div>
    </div>
  );
}

export function TimelineSkeleton() {
  return (
    <div className="space-y-0">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="grid grid-cols-[54px_minmax(0,1fr)] gap-3.5 sm:grid-cols-[72px_minmax(0,1fr)] sm:gap-[22px]"
        >
          <Skeleton className="mt-3.5 ml-auto h-10 w-12" />
          <div className="border-l-2 pb-8 pl-5 sm:pl-7">
            <Skeleton className="h-[120px] rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface DatabaseTimelineProps {
  readonly items: readonly TimelineEntry[];
  readonly groupSize: number;
  readonly hasMore: boolean;
  readonly isLoadingMore: boolean;
  readonly onLoadMore: () => void;
}

export function DatabaseTimeline({
  items,
  groupSize,
  hasMore,
  isLoadingMore,
  onLoadMore,
}: DatabaseTimelineProps) {
  return (
    <div>
      <div className="mt-2">
        {items.map((entry, index) => (
          <TimelineRow
            key={entry.sessionId}
            entry={entry}
            groupSize={groupSize}
            isLast={index === items.length - 1}
          />
        ))}
      </div>
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
