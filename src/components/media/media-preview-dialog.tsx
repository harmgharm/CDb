"use client";

import {
  BookmarkCheckIcon,
  BookmarkPlusIcon,
  CalendarIcon,
  CheckIcon,
  ClapperboardIcon,
  ClockIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FilmIcon,
  LoaderIcon,
  MonitorPlayIcon,
  PlayCircleIcon,
  StarIcon,
  TvIcon,
  UsersIcon,
} from "lucide-react";
import { VisuallyHidden } from "radix-ui";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useMediaPreview } from "@/hooks/use-media";
import type { MediaSearchResult } from "@/types/media";

interface MediaPreviewDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly result: MediaSearchResult;
  readonly isImporting: boolean;
  readonly onImport: () => void;
  readonly isWatchlisted: boolean;
  readonly isAddingToWatchlist: boolean;
  readonly onAddToWatchlist: () => void;
  readonly isRemovingFromWatchlist?: boolean;
  readonly onRemoveFromWatchlist?: () => void;
  /** When provided, renders a "Propose to group" action (Watchlist · Propose · Import). */
  readonly onPropose?: () => void;
  readonly isProposing?: boolean;
  /** True once the title is in the group queue — renders the disabled "Proposed" state. */
  readonly isProposed?: boolean;
}

function formatRuntime(minutes: number): string {
  if (minutes < 60) return `${String(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${String(hours)}h` : `${String(hours)}h ${String(remainder)}m`;
}

function PreviewMetadata({
  result,
  detail,
  isLoading,
}: {
  readonly result: MediaSearchResult;
  readonly detail: ReturnType<typeof useMediaPreview>["data"];
  readonly isLoading: boolean;
}) {
  const genres = result.genres ?? [];
  const voteAverage = result.voteAverage ?? null;

  return (
    <div className="space-y-3">
      {/* Badges row: year, rating, runtime/episodes */}
      <div className="flex flex-wrap items-center gap-1.5">
        {result.releaseYear !== null && (
          <Badge variant="outline" className="gap-1 text-xs">
            <CalendarIcon className="size-3" />
            {String(result.releaseYear)}
          </Badge>
        )}
        {voteAverage !== null && (
          <Badge variant="outline" className="gap-1 text-xs">
            <StarIcon className="size-3 fill-amber-500 text-amber-500" />
            {String(Math.round(voteAverage * 10) / 10)}
          </Badge>
        )}
        <RuntimeBadge result={result} detail={detail} isLoading={isLoading} />
      </div>

      {/* Genres */}
      {genres.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {genres.map((genre) => (
            <Badge key={genre} variant="secondary" className="text-xs">
              {genre}
            </Badge>
          ))}
        </div>
      )}

      {/* Detail metadata (lazy-loaded) */}
      {isLoading && (
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <LoaderIcon className="size-3 animate-spin" />
          Loading details...
        </div>
      )}
      <DetailInfo result={result} detail={detail} />
    </div>
  );
}

function RuntimeBadge({
  result,
  detail,
  isLoading,
}: {
  readonly result: MediaSearchResult;
  readonly detail: ReturnType<typeof useMediaPreview>["data"];
  readonly isLoading: boolean;
}) {
  // Anime: episode count comes from search results
  if (result.episodeCount !== null && result.episodeCount !== undefined) {
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <MonitorPlayIcon className="size-3" />
        {String(result.episodeCount)} eps
      </Badge>
    );
  }

  if (isLoading || detail === undefined) return null;

  // TV: episodes + seasons from detail
  if (detail.episodeCount !== null) {
    return (
      <>
        <Badge variant="outline" className="gap-1 text-xs">
          <MonitorPlayIcon className="size-3" />
          {String(detail.episodeCount)} eps
        </Badge>
        {detail.seasonCount !== null && (
          <Badge variant="outline" className="gap-1 text-xs">
            <TvIcon className="size-3" />
            {String(detail.seasonCount)} season{detail.seasonCount === 1 ? "" : "s"}
          </Badge>
        )}
      </>
    );
  }

  // Movie: runtime from detail
  if (detail.runtime !== null) {
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <ClockIcon className="size-3" />
        {formatRuntime(detail.runtime)}
      </Badge>
    );
  }

  return null;
}

function DetailInfo({
  result,
  detail,
}: {
  readonly result: MediaSearchResult;
  readonly detail: ReturnType<typeof useMediaPreview>["data"];
}) {
  if (detail === undefined) return null;

  const items: { label: string; value: string; icon: React.ReactNode }[] = [];

  if (detail.director !== null) {
    items.push({
      label: "Director",
      value: detail.director,
      icon: <ClapperboardIcon className="size-3.5" />,
    });
  }

  if (detail.creator !== null) {
    items.push({
      label: "Creator",
      value: detail.creator,
      icon: <ClapperboardIcon className="size-3.5" />,
    });
  }

  // Studios: from detail for TMDB, from search result for Jikan
  const studios = detail.studios.length > 0 ? detail.studios : (result.studios ?? []);
  if (studios.length > 0) {
    items.push({
      label: "Studio",
      value: studios.slice(0, 3).join(", "),
      icon: <FilmIcon className="size-3.5" />,
    });
  }

  if (detail.status !== null) {
    items.push({
      label: "Status",
      value: detail.status,
      icon: <MonitorPlayIcon className="size-3.5" />,
    });
  }

  if (items.length === 0 && detail.trailerUrl === null) return null;

  return (
    <div className="space-y-1.5">
      {items.map((item) => (
        <div key={item.label} className="text-muted-foreground flex items-center gap-2 text-xs">
          {item.icon}
          <span className="text-foreground font-medium">{item.label}:</span>
          <span>{item.value}</span>
        </div>
      ))}
      {detail.trailerUrl !== null && (
        <a
          href={detail.trailerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs transition-colors"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <PlayCircleIcon className="size-3.5" />
          <span className="font-medium">Watch Trailer</span>
          <ExternalLinkIcon className="size-2.5" />
        </a>
      )}
    </div>
  );
}

export function MediaPreviewDialog({
  open,
  onOpenChange,
  result,
  isImporting,
  onImport,
  isWatchlisted,
  isAddingToWatchlist,
  onAddToWatchlist,
  isRemovingFromWatchlist = false,
  onRemoveFromWatchlist,
  onPropose,
  isProposing = false,
  isProposed = false,
}: MediaPreviewDialogProps) {
  const { data: detail, isLoading } = useMediaPreview(
    open ? result.source : null,
    open ? result.externalId : null,
    open ? result.type : null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] sm:max-w-md">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate">{result.title}</span>
            <MediaTypeBadge type={result.type} />
          </DialogTitle>
          {/* Radix requires every DialogContent to be described. Show the tagline
              when the title has one; otherwise keep a screen-reader-only fallback
              so the description association exists without doubling up the synopsis
              that's already rendered visibly in the body below. */}
          {detail?.tagline !== undefined && detail.tagline !== null ? (
            <DialogDescription className="italic">{detail.tagline}</DialogDescription>
          ) : (
            <VisuallyHidden.Root asChild>
              <DialogDescription>Preview details for {result.title}</DialogDescription>
            </VisuallyHidden.Root>
          )}
        </DialogHeader>

        <div className="flex gap-4">
          <MediaPoster
            posterUrl={result.posterUrl}
            title={result.title}
            className="h-36 w-24 shrink-0"
          />
          <PreviewMetadata result={result} detail={detail} isLoading={isLoading} />
        </div>

        {/* Synopsis */}
        {result.overview !== null && result.overview.length > 0 && (
          <>
            <Separator />
            <div className="max-h-40 overflow-y-auto">
              <p className="text-muted-foreground text-sm leading-relaxed">{result.overview}</p>
            </div>
          </>
        )}

        {/* Actions */}
        <Separator />
        <div className="flex justify-end gap-2">
          {isWatchlisted ? (
            <Button
              size="sm"
              variant="outline"
              disabled={onRemoveFromWatchlist === undefined || isRemovingFromWatchlist}
              onClick={(event) => {
                event.stopPropagation();
                onRemoveFromWatchlist?.();
              }}
            >
              {isRemovingFromWatchlist ? (
                <LoaderIcon className="mr-1 size-3.5 animate-spin" />
              ) : (
                <BookmarkCheckIcon className="mr-1 size-3.5" />
              )}
              Watchlisted
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={isAddingToWatchlist}
              onClick={(event) => {
                event.stopPropagation();
                onAddToWatchlist();
              }}
            >
              {isAddingToWatchlist ? (
                <LoaderIcon className="mr-1 size-3.5 animate-spin" />
              ) : (
                <BookmarkPlusIcon className="mr-1 size-3.5" />
              )}
              Watchlist
            </Button>
          )}
          {onPropose !== undefined &&
            (isProposed ? (
              <Button size="sm" variant="outline" className="cdb-imp-proposed" disabled>
                <CheckIcon className="mr-1 size-3.5" />
                Proposed
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={isProposing}
                title="Propose to the group vote"
                onClick={(event) => {
                  event.stopPropagation();
                  onPropose();
                }}
              >
                {isProposing ? (
                  <LoaderIcon className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <UsersIcon className="mr-1 size-3.5" />
                )}
                Propose
              </Button>
            ))}
          <Button
            size="sm"
            disabled={isImporting}
            onClick={(event) => {
              event.stopPropagation();
              onImport();
            }}
          >
            {isImporting ? (
              <LoaderIcon className="mr-1 size-3.5 animate-spin" />
            ) : (
              <DownloadIcon className="mr-1 size-3.5" />
            )}
            Import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
