"use client";

import { DownloadIcon, EyeIcon, InfoIcon, StarIcon, UsersIcon, XCircleIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { useState } from "react";

import { ImportMediaDialog } from "@/components/media/import-media-dialog";
import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { RecommendationReasonTags } from "@/components/recommendations/recommendation-reason-tags";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AddToWatchlistButton } from "@/components/watchlist/add-to-watchlist-button";
import type { RecommendationItem } from "@/types/recommendation-responses";

interface RecommendationCardProps {
  readonly item: RecommendationItem;
  readonly index: number;
  readonly onWatchlistChange?: () => void;
  readonly onDismiss?: (item: RecommendationItem) => void;
}

export function RecommendationCard({
  item,
  index,
  onWatchlistChange,
  onDismiss,
}: RecommendationCardProps) {
  const hasDbEntry = item.mediaId !== null;
  const watchlistCount = item.watchlistCount ?? 0;
  const friends = item.watchedByFriends ?? [];
  const hasFriendWatches = friends.length > 0;
  const [importOpen, setImportOpen] = useState(false);

  const posterOverlay = (
    <>
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
    </>
  );

  const cardInfo = (
    <div className="space-y-1.5 p-3">
      <h3 className="truncate text-sm font-medium">{item.title}</h3>
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        {item.releaseYear !== null && <span>{String(item.releaseYear)}</span>}
      </div>
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <RecommendationReasonTags reasons={item.reasons} />
        </div>
      </div>
      {hasFriendWatches && <FriendWatchBadge friends={friends} />}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" as const }}
      className="relative"
    >
      {hasDbEntry ? (
        <Link
          href={`/database/${String(item.mediaId)}`}
          className="group hover:border-primary/50 block overflow-hidden rounded-lg border transition-colors"
        >
          <div className="relative aspect-[2/3] overflow-hidden">
            <MediaPoster
              posterUrl={item.posterUrl}
              title={item.title}
              className="size-full transition-transform duration-300 group-hover:scale-105"
            />
            {posterOverlay}
          </div>
          {cardInfo}
        </Link>
      ) : (
        <div
          role="button"
          tabIndex={0}
          className="group hover:border-primary/50 cursor-pointer overflow-hidden rounded-lg border text-left transition-colors"
          onClick={() => {
            setImportOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setImportOpen(true);
            }
          }}
        >
          <div className="relative aspect-[2/3] overflow-hidden">
            <MediaPoster
              posterUrl={item.posterUrl}
              title={item.title}
              className="size-full transition-transform duration-300 group-hover:scale-105"
            />
            {posterOverlay}

            {/* Import indicator */}
            <div className="absolute right-2 bottom-10 opacity-0 transition-opacity group-hover:opacity-100">
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <DownloadIcon className="size-2.5" />
                Import
              </Badge>
            </div>
          </div>
          {cardInfo}
        </div>
      )}

      {/* Action buttons — positioned outside the link/button to avoid nesting */}
      <div className="absolute top-2 left-2 flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 [div:hover>&]:opacity-100">
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
        {onDismiss !== undefined && (
          <button
            type="button"
            className="bg-background/80 text-muted-foreground hover:text-destructive hover:bg-background rounded-full p-1.5 backdrop-blur-sm transition-colors"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDismiss(item);
            }}
          >
            <XCircleIcon className="size-4" />
            <span className="sr-only">Not interested</span>
          </button>
        )}
      </div>

      {/* Why This popover */}
      {item.reasons.length > 0 && (
        <div className="absolute right-2 bottom-2">
          <WhyThisPopover item={item} />
        </div>
      )}

      {/* Import dialog — only rendered when open to avoid mass API calls */}
      {importOpen && (
        <ImportMediaDialog
          key={item.title}
          open={importOpen}
          onOpenChange={setImportOpen}
          onSuccess={() => {
            setImportOpen(false);
          }}
          initialQuery={item.title}
        />
      )}
    </motion.div>
  );
}

function FriendWatchBadge({
  friends,
}: {
  readonly friends: NonNullable<RecommendationItem["watchedByFriends"]>;
}) {
  const ratedFriends = friends.filter((f) => f.score > 0);
  const avgScore =
    ratedFriends.length > 0
      ? Math.round((ratedFriends.reduce((sum, f) => sum + f.score, 0) / ratedFriends.length) * 10) /
        10
      : null;

  const names = friends.slice(0, 3).map((f) => f.displayName ?? f.username);
  const overflow = friends.length > 3 ? ` +${String(friends.length - 3)}` : "";
  const nameList = `${names.join(", ")}${overflow} watched this`;
  const tooltipText = avgScore === null ? nameList : `${nameList} (avg ${String(avgScore)})`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1">
          <Badge
            variant="outline"
            className="gap-1 border-violet-500/30 bg-violet-500/10 text-[10px] text-violet-400"
          >
            <EyeIcon className="size-2.5" />
            {String(friends.length)} friend{friends.length === 1 ? "" : "s"} watched
            {avgScore !== null && (
              <span className="ml-0.5 font-semibold">({String(avgScore)})</span>
            )}
          </Badge>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64 text-xs">
        {tooltipText}
      </TooltipContent>
    </Tooltip>
  );
}

function WhyThisPopover({ item }: { readonly item: RecommendationItem }) {
  const hasOverview = item.overview !== null && item.overview.length > 0;
  const hasGenres = item.genres.length > 0;
  const hasDetails =
    item.releaseYear !== null || (item.voteAverage !== null && item.voteAverage > 0);

  if (!hasOverview && !hasGenres && !hasDetails) return null;

  return (
    <Popover>
      <PopoverTrigger className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-full p-1 transition-colors">
        <InfoIcon className="size-3.5" />
        <span className="sr-only">About this title</span>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-80">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">{item.title}</h4>

          {/* Media details */}
          {(hasDetails || hasGenres) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {item.releaseYear !== null && (
                <Badge variant="outline" className="text-[10px]">
                  {String(item.releaseYear)}
                </Badge>
              )}
              {item.voteAverage !== null && item.voteAverage > 0 && (
                <Badge variant="outline" className="gap-0.5 text-[10px]">
                  <StarIcon className="size-2.5 fill-amber-500 text-amber-500" />
                  {String(Math.round(item.voteAverage * 10) / 10)}
                </Badge>
              )}
              {item.genres.slice(0, 4).map((genre) => (
                <Badge key={genre} variant="secondary" className="text-[10px]">
                  {genre}
                </Badge>
              ))}
              {item.genres.length > 4 && (
                <span className="text-muted-foreground text-[10px]">
                  +{String(item.genres.length - 4)}
                </span>
              )}
            </div>
          )}

          {/* Overview */}
          {hasOverview && (
            <div className="border-t pt-2">
              <p className="text-muted-foreground max-h-32 overflow-y-auto text-xs">
                {item.overview}
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
