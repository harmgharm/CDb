"use client";

import Link from "next/link";

import { MediaPoster } from "@/components/media/media-poster";
import { useSidebar } from "@/components/ui/sidebar";
import { type UpNextSource, useUpNext } from "@/hooks/use-up-next";

const LABELS: Record<UpNextSource, string> = {
  "in-progress": "In progress",
  watchlist: "Up next in your watchlist",
};

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
            {LABELS[source]}
          </span>
          <span className="truncate text-sm font-medium">{data.title}</span>
        </div>
      </Link>
    </div>
  );
}
