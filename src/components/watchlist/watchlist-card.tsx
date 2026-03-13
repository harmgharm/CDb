"use client";

import {
  BookmarkXIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  ListIcon,
  SparklesIcon,
  XCircleIcon,
} from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaPreviewDialog } from "@/components/media/media-preview-dialog";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useAddToWatchlist,
  useRemoveFromWatchlist,
  useUpdateWatchlistEntry,
} from "@/hooks/use-watchlist";
import type { WatchlistStatus } from "@/lib/db/types";
import type { MediaSearchResult } from "@/types/media";
import type { PredictionSummary } from "@/types/prediction-responses";
import type { WatchlistItem } from "@/types/watchlist-responses";

import { WatchlistStatusBadge } from "./watchlist-status-badge";

/** Convert a watchlist entry with external IDs into a MediaSearchResult for the preview dialog */
function toSearchResult(entry: WatchlistItem): MediaSearchResult | null {
  if (entry.tmdb_id !== null) {
    return {
      externalId: entry.tmdb_id,
      title: entry.title,
      type: entry.media_type,
      posterUrl: entry.poster_url,
      releaseYear: null,
      overview: null,
      source: "tmdb",
    };
  }
  if (entry.mal_id !== null) {
    return {
      externalId: entry.mal_id,
      title: entry.title,
      type: entry.media_type,
      posterUrl: entry.poster_url,
      releaseYear: null,
      overview: null,
      source: "jikan",
    };
  }
  return null;
}

const STATUS_OPTIONS: { value: WatchlistStatus; label: string; icon: typeof ListIcon }[] = [
  { value: "planning", label: "Planning", icon: ListIcon },
  { value: "watching", label: "Watching", icon: EyeIcon },
  { value: "scrapped", label: "Scrapped", icon: XCircleIcon },
];

interface WatchlistCardLinkProps {
  readonly mediaId: string | null;
  readonly searchResult: MediaSearchResult | null;
  readonly previewOpen: boolean;
  readonly onPreviewOpenChange: (open: boolean) => void;
  readonly isWatchlisted: boolean;
  readonly isAddingToWatchlist: boolean;
  readonly onAddToWatchlist: () => void;
  readonly isRemoving?: boolean;
  readonly onRemoveFromWatchlist?: () => void;
  readonly children: React.ReactNode;
}

function WatchlistCardLink({
  mediaId,
  searchResult,
  previewOpen,
  onPreviewOpenChange,
  isWatchlisted,
  isAddingToWatchlist,
  onAddToWatchlist,
  isRemoving = false,
  onRemoveFromWatchlist,
  children,
}: WatchlistCardLinkProps) {
  if (mediaId !== null) {
    return (
      <Link href={`/database/${mediaId}`} className="block">
        {children}
      </Link>
    );
  }

  if (searchResult === null) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="cursor-pointer"
        onClick={() => {
          onPreviewOpenChange(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            onPreviewOpenChange(true);
          }
        }}
      >
        {children}
      </div>
      <MediaPreviewDialog
        open={previewOpen}
        onOpenChange={onPreviewOpenChange}
        result={searchResult}
        isImporting={false}
        onImport={() => {
          /* no-op: import not available from watchlist card */
        }}
        isWatchlisted={isWatchlisted}
        isAddingToWatchlist={isAddingToWatchlist}
        onAddToWatchlist={onAddToWatchlist}
        isRemovingFromWatchlist={isRemoving}
        onRemoveFromWatchlist={onRemoveFromWatchlist}
      />
    </>
  );
}

function getPredictionColor(score: number): string {
  if (score >= 8) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  if (score >= 6.5) return "border-blue-500/30 bg-blue-500/10 text-blue-400";
  if (score >= 5) return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
  return "border-red-500/30 bg-red-500/10 text-red-400";
}

interface WatchlistCardProps {
  readonly entry: WatchlistItem;
  readonly index: number;
  readonly isOwnProfile: boolean;
  readonly onChanged: () => void;
  readonly prediction?: PredictionSummary;
}

export function WatchlistCard({
  entry,
  index,
  isOwnProfile,
  onChanged,
  prediction,
}: WatchlistCardProps) {
  const { updateEntry } = useUpdateWatchlistEntry();
  const { removeFromWatchlist, isRemoving } = useRemoveFromWatchlist();
  const { addToWatchlist, isAdding: isAddingToWatchlist } = useAddToWatchlist();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [myWatchlistEntryId, setMyWatchlistEntryId] = useState<string>();
  const [locallyRemoved, setLocallyRemoved] = useState(false);
  const searchResult = entry.media_id === null ? toSearchResult(entry) : null;

  // On own profile, the entry is always in the user's watchlist.
  // On other profiles, track whether the current user has added it to their own watchlist.
  const isInMyWatchlist = isOwnProfile ? true : myWatchlistEntryId !== undefined && !locallyRemoved;

  async function handleStatusChange(newStatus: WatchlistStatus) {
    const success = await updateEntry(entry.id, { status: newStatus });
    if (success) {
      toast.success(`Status changed to ${newStatus}`);
      onChanged();
    } else {
      toast.error("Failed to update status");
    }
  }

  async function handleRemove() {
    const success = await removeFromWatchlist(entry.id);
    if (success) {
      toast.success("Removed from watchlist");
      onChanged();
    } else {
      toast.error("Failed to remove");
    }
  }

  const cardContent = (
    <div className="flex gap-3">
      <MediaPoster
        posterUrl={entry.poster_url}
        title={entry.title}
        className="h-24 w-16 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-medium">{entry.title}</h4>
        <div className="mt-1 flex items-center gap-1.5">
          <MediaTypeBadge type={entry.media_type} />
          <WatchlistStatusBadge status={entry.status} />
          {prediction !== undefined && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className={`gap-0.5 text-[10px] ${getPredictionColor(prediction.predictedScore)}`}
                >
                  <SparklesIcon className="size-2.5" />
                  {String(prediction.predictedScore)}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Predicted rating: {String(prediction.predictedScore)}/10 — {prediction.verdict} (
                {prediction.confidence} confidence)
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {entry.notes !== null && entry.notes.length > 0 && (
          <p className="text-muted-foreground mt-1.5 line-clamp-2 text-xs">{entry.notes}</p>
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" as const }}
      className="group relative rounded-lg border p-3"
    >
      <WatchlistCardLink
        mediaId={entry.media_id}
        searchResult={searchResult}
        previewOpen={previewOpen}
        onPreviewOpenChange={setPreviewOpen}
        isWatchlisted={isInMyWatchlist}
        isAddingToWatchlist={isAddingToWatchlist}
        onAddToWatchlist={() => {
          void (async () => {
            const added = await addToWatchlist({
              mediaId: entry.media_id ?? undefined,
              tmdbId: entry.tmdb_id ?? undefined,
              malId: entry.mal_id ?? undefined,
              extTitle: entry.title,
              extPosterUrl: entry.poster_url,
              extMediaType: entry.media_type,
            });
            if (added === null) {
              toast.error("Failed to add to watchlist");
            } else {
              setMyWatchlistEntryId(added.id);
              setLocallyRemoved(false);
              toast.success("Added to watchlist");
            }
          })();
        }}
        isRemoving={isRemoving}
        onRemoveFromWatchlist={() => {
          const entryIdToRemove = isOwnProfile ? entry.id : myWatchlistEntryId;
          if (entryIdToRemove === undefined) return;
          void (async () => {
            const success = await removeFromWatchlist(entryIdToRemove);
            if (success) {
              if (isOwnProfile) {
                setPreviewOpen(false);
                onChanged();
              } else {
                setMyWatchlistEntryId(undefined);
                setLocallyRemoved(true);
              }
              toast.success("Removed from watchlist");
            } else {
              toast.error("Failed to remove from watchlist");
            }
          })();
        }}
      >
        {cardContent}
      </WatchlistCardLink>

      {isOwnProfile && (
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <EllipsisVerticalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Change Status</DropdownMenuLabel>
              {STATUS_OPTIONS.filter((opt) => opt.value !== entry.status).map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => {
                    void handleStatusChange(opt.value);
                  }}
                >
                  <opt.icon className="mr-2 size-4" />
                  {opt.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  void handleRemove();
                }}
              >
                <BookmarkXIcon className="mr-2 size-4" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </motion.div>
  );
}
