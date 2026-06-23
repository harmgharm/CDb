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
        className="hover:bg-sidebar-accent flex items-stretch gap-3 rounded-lg p-2 transition-colors"
      >
        <div className="relative shrink-0">
          <MediaPoster
            posterUrl={data.posterUrl}
            title={data.title}
            className="aspect-[2/3] w-12"
          />
          <span
            aria-hidden="true"
            className="bg-cdb-marquee animate-up-next-pulse absolute -top-1 -right-1 size-2 rounded-full"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
            {eyebrowFor(data, source)}
          </span>
          <span className="truncate text-sm font-medium">{data.title}</span>
          {data.proposedBy !== undefined && (
            <span className="text-muted-foreground truncate text-[11px]">
              Proposed by <span className="text-foreground">{data.proposedBy}</span>
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}
