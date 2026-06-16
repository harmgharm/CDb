"use client";

import { CheckIcon, ClockIcon } from "lucide-react";
import Link from "next/link";

import { MediaPoster } from "@/components/media/media-poster";
import { Skeleton } from "@/components/ui/skeleton";
import type { NowShowingItem } from "@/hooks/use-now-showing";
import { useNowShowing } from "@/hooks/use-now-showing";

function formatWatchedDate(dateWatched: string | null): string | null {
  if (dateWatched === null) return null;
  return new Date(dateWatched).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function StatusPill({ status }: Readonly<{ status: NowShowingItem["status"] }>) {
  const base =
    "inline-flex h-[18px] items-center gap-1 rounded-full px-2 text-[10px] font-medium tracking-[0.05em] uppercase";

  if (status === "rated") {
    return (
      <span className={`${base} bg-cdb-tv/15 text-cdb-tv`}>
        <CheckIcon className="size-2.5" /> Rated
      </span>
    );
  }

  return (
    <span className={`${base} bg-cdb-marquee/15 text-cdb-marquee-text`}>
      <ClockIcon className="size-2.5" /> Rating in progress
    </span>
  );
}

function NowShowingCard({ item }: Readonly<{ item: NowShowingItem }>) {
  const date = formatWatchedDate(item.dateWatched);
  const subline = item.status === "rated" ? "You rated this." : "You still need to rate this.";

  return (
    <Link
      href={item.href}
      className="bg-card hover:border-cdb-marquee/55 flex gap-3.5 rounded-lg border p-3.5 transition-colors"
    >
      <MediaPoster
        posterUrl={item.posterUrl}
        title={item.title}
        className="aspect-[2/3] w-[78px] shrink-0"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={item.status} />
          {date !== null && (
            <span className="font-mono text-[10px] text-[var(--fg-dim)]">{date}</span>
          )}
        </div>
        <div className="font-display truncate text-[22px] leading-none font-normal tracking-[-0.015em]">
          {item.title}
        </div>
        <div className="text-muted-foreground text-xs">{subline}</div>
      </div>
    </Link>
  );
}

function NowShowingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className="bg-card flex gap-3.5 rounded-lg border p-3.5">
          <Skeleton className="aspect-[2/3] w-[78px] shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-2 py-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NowShowing() {
  const { items, isLoading } = useNowShowing();

  if (isLoading) {
    return (
      <section className="flex flex-col gap-3.5">
        <p className="text-xs font-semibold tracking-[0.12em] text-[var(--fg-dim)] uppercase">
          Now showing
        </p>
        <NowShowingSkeleton />
      </section>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3.5">
      <p className="text-xs font-semibold tracking-[0.12em] text-[var(--fg-dim)] uppercase">
        Now showing
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <NowShowingCard key={item.sessionId} item={item} />
        ))}
      </div>
    </section>
  );
}
