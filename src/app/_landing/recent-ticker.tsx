"use client";

import Image from "next/image";

import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Badge } from "@/components/ui/badge";

import type { PublicStats } from "./types";

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

interface RecentTickerProps {
  readonly stats: PublicStats;
}

export function RecentTicker({ stats }: RecentTickerProps) {
  if (stats.recentMedia.length === 0) {
    return null;
  }

  const seen = new Set<string>();
  const unique = stats.recentMedia.filter((media) => {
    if (seen.has(media.title)) {
      return false;
    }
    seen.add(media.title);
    return true;
  });

  // Duplicate items 4x for seamless loop on wide viewports.
  const items = [...unique, ...unique, ...unique, ...unique];

  return (
    <section className="border-border border-t py-6">
      <div className="relative overflow-hidden">
        <div className="animate-ticker flex w-max gap-8 hover:[animation-play-state:paused]">
          {items.map((media, index) => (
            <div
              key={`${media.title}-${String(index)}`}
              className="flex shrink-0 items-center gap-3"
            >
              {media.posterUrl !== null && (
                <div className="relative h-10 w-7 shrink-0 overflow-hidden rounded">
                  <Image
                    src={media.posterUrl}
                    alt={`${media.title} poster`}
                    fill
                    className="object-cover"
                    sizes="28px"
                  />
                </div>
              )}
              <span className="text-sm font-medium">{media.title}</span>
              <MediaTypeBadge type={media.type} />
              <Badge variant="outline" className="text-muted-foreground text-xs">
                {formatDate(media.dateWatched)}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
