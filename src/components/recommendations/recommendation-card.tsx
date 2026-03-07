"use client";

import { StarIcon, UsersIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { RecommendationReasonTags } from "@/components/recommendations/recommendation-reason-tags";
import { Badge } from "@/components/ui/badge";
import { AddToWatchlistButton } from "@/components/watchlist/add-to-watchlist-button";
import type { RecommendationItem } from "@/types/recommendation-responses";

interface RecommendationCardProps {
  readonly item: RecommendationItem;
  readonly index: number;
  readonly onWatchlistChange?: () => void;
}

export function RecommendationCard({ item, index, onWatchlistChange }: RecommendationCardProps) {
  const hasDbEntry = item.mediaId !== null;
  const watchlistCount = item.watchlistCount ?? 0;

  const cardContent = (
    <>
      <div className="relative aspect-[2/3] overflow-hidden">
        <MediaPoster
          posterUrl={item.posterUrl}
          title={item.title}
          className="size-full transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Type badge + vote average */}
        <div className="absolute right-2 bottom-2 left-2 flex items-end justify-between">
          <MediaTypeBadge type={item.mediaType} />
          {item.voteAverage !== null && item.voteAverage > 0 && (
            <Badge variant="secondary" className="gap-0.5 text-[10px]">
              <StarIcon className="size-2.5 fill-amber-500 text-amber-500" />
              {String(Math.round(item.voteAverage * 10) / 10)}
            </Badge>
          )}
        </div>

        {/* Watchlist count badge (top right) */}
        {watchlistCount > 0 && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="gap-0.5 bg-orange-500/80 text-[10px] text-white">
              <UsersIcon className="size-2.5" />
              {String(watchlistCount)}
            </Badge>
          </div>
        )}

        {/* Add to watchlist button (top left, visible on hover) */}
        <div className="absolute top-2 left-2 opacity-0 transition-opacity group-hover:opacity-100">
          <AddToWatchlistButton
            mediaId={hasDbEntry ? (item.mediaId ?? undefined) : undefined}
            tmdbId={item.tmdbId ?? undefined}
            malId={item.malId ?? undefined}
            extTitle={hasDbEntry ? undefined : item.title}
            extPosterUrl={hasDbEntry ? undefined : item.posterUrl}
            extMediaType={hasDbEntry ? undefined : item.mediaType}
            existingEntryId={item.watchlistEntryId}
            onAdded={onWatchlistChange}
            onRemoved={onWatchlistChange}
            size="icon"
          />
        </div>
      </div>

      <div className="space-y-1.5 p-3">
        <h3 className="truncate text-sm font-medium">{item.title}</h3>
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          {item.releaseYear !== null && <span>{String(item.releaseYear)}</span>}
        </div>
        <RecommendationReasonTags reasons={item.reasons} />
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" as const }}
    >
      {hasDbEntry ? (
        <Link
          href={`/database/${String(item.mediaId)}`}
          className="group hover:border-primary/50 block overflow-hidden rounded-lg border transition-colors"
        >
          {cardContent}
        </Link>
      ) : (
        <div className="group hover:border-primary/50 overflow-hidden rounded-lg border transition-colors">
          {cardContent}
        </div>
      )}
    </motion.div>
  );
}
