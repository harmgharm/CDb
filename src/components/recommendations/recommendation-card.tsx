"use client";

import { EyeIcon, EyeOffIcon, StarIcon, UsersIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ImportMediaDialog } from "@/components/media/import-media-dialog";
import { MediaPoster } from "@/components/media/media-poster";
import { MediaPreviewDialog } from "@/components/media/media-preview-dialog";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { RecommendationReasonTags } from "@/components/recommendations/recommendation-reason-tags";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAddToWatchlist, useRemoveFromWatchlist } from "@/hooks/use-watchlist";
import type { MediaSearchResult } from "@/types/media";
import type { RecommendationItem } from "@/types/recommendation-responses";

/** Convert a RecommendationItem to a MediaSearchResult for the preview dialog.
 *  Prefers TMDB as source when available (better trailer/metadata coverage). */
function toSearchResult(item: RecommendationItem): MediaSearchResult {
  const source = item.tmdbId === null ? "jikan" : "tmdb";
  const externalId = source === "tmdb" ? (item.tmdbId ?? 0) : (item.malId ?? 0);

  return {
    externalId,
    title: item.title,
    type: item.mediaType,
    posterUrl: item.posterUrl,
    releaseYear: item.releaseYear,
    overview: item.overview,
    source,
    voteAverage: item.voteAverage,
    genres: item.genres,
    existingMediaId: item.mediaId ?? undefined,
  };
}

interface RecommendationCardProps {
  readonly item: RecommendationItem;
  readonly index: number;
  readonly onDismiss?: (item: RecommendationItem) => void;
}

export function RecommendationCard({ item, index, onDismiss }: RecommendationCardProps) {
  const hasDbEntry = item.mediaId !== null;
  const watchlistCount = item.watchlistCount ?? 0;
  const friends = item.watchedByFriends ?? [];
  const hasFriendWatches = friends.length > 0;
  const [importOpen, setImportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [localWatchlistEntryId, setLocalWatchlistEntryId] = useState<string>();
  const [locallyRemoved, setLocallyRemoved] = useState(false);
  const { addToWatchlist, isAdding: isAddingToWatchlist } = useAddToWatchlist();
  const { removeFromWatchlist, isRemoving: isRemovingFromWatchlist } = useRemoveFromWatchlist();

  const watchlistEntryId = locallyRemoved
    ? undefined
    : (localWatchlistEntryId ?? item.watchlistEntryId);
  const isWatchlisted = watchlistEntryId !== undefined;

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
      <div className="text-muted-foreground flex h-4 items-center gap-2 text-xs">
        {item.releaseYear !== null && <span>{String(item.releaseYear)}</span>}
      </div>
      <div className="flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <RecommendationReasonTags reasons={item.reasons} />
        </div>
        {onDismiss !== undefined && (
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive inline-flex shrink-0 items-center gap-1 text-xs opacity-100 transition-all sm:opacity-0 sm:group-hover:opacity-100"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDismiss(item);
            }}
          >
            <EyeOffIcon className="size-3" />
            <span className="hidden sm:inline">Not interested</span>
          </button>
        )}
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
            setPreviewOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setPreviewOpen(true);
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
          </div>
          {cardInfo}
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

      {/* Preview dialog for unimported items */}
      {previewOpen && !hasDbEntry && (
        <MediaPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          result={toSearchResult(item)}
          isImporting={false}
          onImport={() => {
            setPreviewOpen(false);
            setImportOpen(true);
          }}
          isWatchlisted={isWatchlisted}
          isAddingToWatchlist={isAddingToWatchlist}
          onAddToWatchlist={() => {
            void (async () => {
              const entry = await addToWatchlist({
                tmdbId: item.tmdbId ?? undefined,
                malId: item.malId ?? undefined,
                extTitle: item.title,
                extPosterUrl: item.posterUrl,
                extMediaType: item.mediaType,
              });
              if (entry === null) {
                toast.error("Failed to add to watchlist");
              } else {
                setLocalWatchlistEntryId(entry.id);
                setLocallyRemoved(false);
                toast.success("Added to watchlist");
              }
            })();
          }}
          isRemovingFromWatchlist={isRemovingFromWatchlist}
          onRemoveFromWatchlist={
            watchlistEntryId === undefined
              ? undefined
              : () => {
                  void (async () => {
                    const success = await removeFromWatchlist(watchlistEntryId);
                    if (success) {
                      setLocalWatchlistEntryId(undefined);
                      setLocallyRemoved(true);
                      toast.success("Removed from watchlist");
                    } else {
                      toast.error("Failed to remove from watchlist");
                    }
                  })();
                }
          }
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
