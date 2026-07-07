"use client";

import Link from "next/link";

import { MediaPoster } from "@/components/media/media-poster";
import { useSidebar } from "@/components/ui/sidebar";
import { type UpNextItem, type UpNextSource, useUpNext } from "@/hooks/use-up-next";

/** Static eyebrow labels for the watchlist-backed sources. The queue source
 *  carries its own dynamic eyebrow (`UP NEXT · {date}`) on the item. */
const LABELS: Record<Exclude<UpNextSource, "queue">, string> = {
  "in-progress": "In progress",
  watchlist: "Up next in your watchlist",
};

/** The eyebrow text for a source: the queue carries its own dynamic eyebrow on
 *  the item (always set by the hook); the watchlist sources use a static label. */
function eyebrowFor(item: UpNextItem, source: UpNextSource): string {
  if (source === "queue") {
    return item.eyebrow ?? "";
  }
  return LABELS[source];
}

export function UpNextCard() {
  const { data, source } = useUpNext();
  const { state } = useSidebar();

  if (data === null || source === null || state === "collapsed") {
    return null;
  }

  return (
    <div className="px-2 pt-2">
      <Link
        href={data.href}
        className="border-border before:bg-cdb-marquee relative flex items-stretch gap-2.5 overflow-hidden rounded-lg border bg-gradient-to-b from-[var(--bg-elev-2)] to-[var(--bg-elev-3)] p-2 transition-colors before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:opacity-85 hover:border-[color-mix(in_oklch,var(--cdb-marquee)_45%,transparent)]"
      >
        <div className="shrink-0">
          <MediaPoster
            posterUrl={data.posterUrl}
            title={data.title}
            className="aspect-[2/3] w-10"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-start gap-0.5">
          <span className="text-cdb-marquee-text inline-flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase">
            <span
              aria-hidden="true"
              className="bg-cdb-marquee animate-up-next-pulse size-1.5 shrink-0 rounded-full"
            />
            {eyebrowFor(data, source)}
          </span>
          <span className="font-display truncate text-[15px] leading-[1.05] tracking-[-0.01em]">
            {data.title}
          </span>
          {data.proposedBy !== undefined && (
            <span className="text-muted-foreground truncate text-[10px]">
              Proposed by <span className="text-foreground">{data.proposedBy}</span>
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}
