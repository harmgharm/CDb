"use client";

import { StarIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Badge } from "@/components/ui/badge";
import type { MediaListItem } from "@/types/media-responses";

const ONGOING_STATUSES = new Set(["Returning Series", "Currently Airing"]);

function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${String(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(remainder)}m`;
}

interface MediaCardProps {
  readonly media: MediaListItem;
  readonly index: number;
}

export function MediaCard({ media, index }: MediaCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" as const }}
    >
      <Link
        href={`/database/${media.id}`}
        className="group hover:border-primary/50 block overflow-hidden rounded-lg border transition-colors"
      >
        <div className="relative aspect-[2/3] overflow-hidden">
          <MediaPoster
            posterUrl={media.poster_url}
            title={media.title}
            className="size-full transition-transform duration-300 group-hover:scale-105"
            priority={index === 0}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute right-2 bottom-2 left-2 flex items-end justify-between">
            <MediaTypeBadge type={media.type} />
            {media.status !== null && ONGOING_STATUSES.has(media.status) && (
              <Badge variant="secondary" className="text-[10px]">
                {media.status}
              </Badge>
            )}
          </div>
        </div>
        <div className="p-3">
          <h3 className="truncate text-sm font-medium">{media.title}</h3>
          <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
            {media.release_year !== null && <span>{String(media.release_year)}</span>}
            {media.runtime_minutes !== null && <span>{formatRuntime(media.runtime_minutes)}</span>}
            {media.episode_count !== null && <span>{String(media.episode_count)} eps</span>}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/** Compact card for search results (no link, click to import) */

interface MediaSearchCardProps {
  readonly posterUrl: string | null;
  readonly title: string;
  readonly type: string;
  readonly releaseYear: number | null;
  readonly overview: string | null;
  readonly rating?: number | null;
}

export function MediaInfoRow({
  posterUrl,
  title,
  releaseYear,
  overview,
  rating,
}: MediaSearchCardProps) {
  return (
    <div className="flex gap-3">
      <MediaPoster posterUrl={posterUrl} title={title} className="h-20 w-14 shrink-0" />
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-medium">{title}</h4>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
          {releaseYear !== null && <span>{String(releaseYear)}</span>}
          {rating !== null && rating !== undefined && (
            <span className="flex items-center gap-0.5">
              <StarIcon className="size-3 fill-amber-500 text-amber-500" />
              {String(rating)}
            </span>
          )}
        </div>
        {overview !== null && overview.length > 0 && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{overview}</p>
        )}
      </div>
    </div>
  );
}
