"use client";

import { StarIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import type { MediaListItem } from "@/types/media-responses";

const ONGOING_STATUSES = new Set(["Returning Series", "Currently Airing"]);

function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${String(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(remainder)}m`;
}

/** The "·"-separated tokens under the title: year, runtime/eps, and ongoing status. */
function buildSubmeta(media: MediaListItem): string[] {
  const tokens: string[] = [];
  if (media.release_year !== null) {
    tokens.push(String(media.release_year));
  }
  if (media.runtime_minutes !== null) {
    tokens.push(formatRuntime(media.runtime_minutes));
  } else if (media.episode_count !== null) {
    tokens.push(`${String(media.episode_count)} eps`);
  }
  if (media.status !== null && ONGOING_STATUSES.has(media.status)) {
    tokens.push(media.status);
  }
  return tokens;
}

interface MediaCardProps {
  readonly media: MediaListItem;
  readonly index: number;
  /**
   * The title's position in the full archive (1-based, page-absolute), shown as
   * a zero-padded mono rank like "#01". The page computes it from page + limit.
   */
  readonly rank: number;
}

export function MediaCard({ media, index, rank }: MediaCardProps) {
  const submeta = buildSubmeta(media);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" as const }}
    >
      <Link
        href={`/database/${media.id}`}
        className="group bg-card hover:border-cdb-marquee/55 flex flex-col overflow-hidden rounded-lg border transition-colors"
      >
        <div className="relative aspect-[2/3] overflow-hidden border-b">
          <MediaPoster
            posterUrl={media.poster_url}
            title={media.title}
            className="size-full transition-transform duration-300 group-hover:scale-105"
            priority={index === 0}
          />
          {/* Top overlay: media type (left) + group rating (right). */}
          <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2">
            <MediaTypeBadge type={media.type} />
            {media.avg_rating !== null && (
              <span className="flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-500">
                <StarIcon className="size-2.5 fill-amber-500 text-amber-500" />
                {media.avg_rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2.5 px-3 pt-2.5 pb-3">
          <span className="pt-px font-mono text-[11px] tracking-[0.06em] text-[var(--fg-dim)]">
            #{String(rank).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[13px] font-medium">{media.title}</h3>
            {submeta.length > 0 && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[var(--fg-muted)]">
                {submeta.map((token, tokenIndex) => (
                  <span key={token} className="flex items-center gap-1.5">
                    {tokenIndex > 0 && <span className="text-[var(--fg-dim)]">·</span>}
                    {token}
                  </span>
                ))}
              </div>
            )}
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
