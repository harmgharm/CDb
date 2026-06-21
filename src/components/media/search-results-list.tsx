"use client";

import {
  AlertTriangleIcon,
  BookmarkCheckIcon,
  BookmarkPlusIcon,
  CheckCircle2Icon,
  CheckIcon,
  DatabaseIcon,
  DownloadIcon,
  LoaderIcon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";

import { MediaInfoRow } from "@/components/media/media-card";
import { MediaPreviewDialog } from "@/components/media/media-preview-dialog";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Button } from "@/components/ui/button";
import type { MediaSearchResult } from "@/types/media";
import type { WatchlistResponse } from "@/types/watchlist-responses";

export interface WatchlistLookup {
  readonly mediaIds: Set<string>;
  readonly tmdbIds: Set<number>;
  readonly malIds: Set<number>;
}

export function buildWatchlistLookup(watchlist: WatchlistResponse | undefined): WatchlistLookup {
  const lookup: WatchlistLookup = { mediaIds: new Set(), tmdbIds: new Set(), malIds: new Set() };
  if (watchlist === undefined) return lookup;
  for (const item of watchlist.items) {
    if (item.media_id !== null) lookup.mediaIds.add(item.media_id);
    if (item.tmdb_id !== null) lookup.tmdbIds.add(item.tmdb_id);
    if (item.mal_id !== null) lookup.malIds.add(item.mal_id);
  }
  return lookup;
}

/**
 * Check if a search result is already in the user's watchlist.
 * Matches by media_id (for imported) or tmdb_id/mal_id (for external).
 */
function isAlreadyWatchlisted(
  result: MediaSearchResult,
  importedMediaId: string | undefined,
  lookup: WatchlistLookup,
): boolean {
  if (importedMediaId !== undefined && lookup.mediaIds.has(importedMediaId)) {
    return true;
  }
  if (result.source === "tmdb") return lookup.tmdbIds.has(result.externalId);
  return lookup.malIds.has(result.externalId);
}

/**
 * Whether a result is already in the group's active queue. The queue keys on a
 * real `media_id`, so this can only match a row that's been imported (in the DB)
 * — an un-imported external result has no id to match and is always proposable.
 * `locallyProposed` covers titles proposed during this dialog session before the
 * queue SWR cache has refreshed.
 */
function isAlreadyProposed(options: {
  importedMediaId: string | undefined;
  queuedMediaIds: ReadonlySet<string>;
  locallyProposed: ReadonlySet<string>;
  key: string;
}): boolean {
  if (options.locallyProposed.has(options.key)) return true;
  return (
    options.importedMediaId !== undefined && options.queuedMediaIds.has(options.importedMediaId)
  );
}

interface SearchResultsListProps {
  readonly isSearching: boolean;
  readonly query: string;
  readonly results: MediaSearchResult[];
  readonly importedMap: Map<string, string>;
  readonly locallyAdded: Set<string>;
  readonly watchlistLookup: WatchlistLookup;
  readonly isAddingToWatchlist: boolean;
  readonly isImporting: boolean;
  /** Active-queue media ids — a row matching one renders the "Proposed" state. */
  readonly queuedMediaIds: ReadonlySet<string>;
  /** Result keys proposed during this dialog session (before SWR refreshes). */
  readonly locallyProposed: ReadonlySet<string>;
  readonly isProposing: boolean;
  readonly onImport: (result: MediaSearchResult) => Promise<void>;
  readonly onAddToWatchlist: (
    result: MediaSearchResult,
    importedMediaId: string | undefined,
  ) => Promise<void>;
  readonly onPropose: (
    result: MediaSearchResult,
    importedMediaId: string | undefined,
  ) => Promise<void>;
  readonly onNavigate: (mediaId: string) => void;
}

function ImportStatusButton({
  isImported,
  isFromDatabase,
  isImporting,
  onImport,
}: {
  readonly isImported: boolean;
  readonly isFromDatabase: boolean;
  readonly isImporting: boolean;
  readonly onImport: () => void;
}) {
  if (!isImported) {
    return (
      <Button
        size="sm"
        disabled={isImporting}
        onClick={(event) => {
          event.stopPropagation();
          onImport();
        }}
      >
        {isImporting ? (
          <LoaderIcon className="mr-1 size-3 animate-spin" />
        ) : (
          <DownloadIcon className="mr-1 size-3" />
        )}
        Import
      </Button>
    );
  }

  if (isFromDatabase) {
    return (
      <Button
        size="sm"
        variant="outline"
        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
      >
        <DatabaseIcon className="mr-1 size-3" />
        In Database
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
    >
      <CheckCircle2Icon className="mr-1 size-3" />
      Added
    </Button>
  );
}

export function SearchResultsList({
  isSearching,
  query,
  results,
  importedMap,
  locallyAdded,
  watchlistLookup,
  isAddingToWatchlist,
  isImporting,
  queuedMediaIds,
  locallyProposed,
  isProposing,
  onImport,
  onAddToWatchlist,
  onPropose,
  onNavigate,
}: SearchResultsListProps) {
  const [previewResult, setPreviewResult] = useState<MediaSearchResult | null>(null);

  if (isSearching) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoaderIcon className="text-muted-foreground size-5 animate-spin" />
        <span className="text-muted-foreground ml-2 text-sm">Searching...</span>
      </div>
    );
  }

  if (query.length > 0 && results.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No results found for &ldquo;{query}&rdquo;
      </p>
    );
  }

  if (query.length === 0 && results.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Start typing to search for movies, TV shows, or anime.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {results.map((result) => {
        const key = `${result.source}-${String(result.externalId)}`;
        const importedMediaId = importedMap.get(key);
        const isImported = importedMediaId !== undefined;
        const alreadyWatchlisted =
          locallyAdded.has(key) || isAlreadyWatchlisted(result, importedMediaId, watchlistLookup);
        const alreadyProposed = isAlreadyProposed({
          importedMediaId,
          queuedMediaIds,
          locallyProposed,
          key,
        });

        const isFromDatabase = result.existingMediaId !== undefined;

        const handleRowClick = () => {
          if (isImported) {
            onNavigate(importedMediaId);
          } else {
            setPreviewResult(result);
          }
        };

        return (
          <div
            key={key}
            role={isImported ? "link" : "button"}
            tabIndex={0}
            className="hover:bg-accent/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors"
            onClick={handleRowClick}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                handleRowClick();
              }
            }}
          >
            <div className="relative min-w-0 flex-1 space-y-1.5">
              <div className="relative">
                {isImported && (
                  <div className="absolute top-0 left-0 z-10 flex size-5 items-center justify-center rounded-full bg-emerald-500 shadow-sm">
                    <CheckIcon className="size-3 text-white" />
                  </div>
                )}
                <MediaInfoRow
                  posterUrl={result.posterUrl}
                  title={result.title}
                  type={result.type}
                  releaseYear={result.releaseYear}
                  overview={result.overview}
                  rating={result.voteAverage}
                />
              </div>
              {result.isPossibleAnime === true && (
                <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangleIcon className="size-3 shrink-0" />
                  <span>
                    This looks like anime. Search under &ldquo;Anime&rdquo; to add the Jikan version
                    instead.
                  </span>
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <MediaTypeBadge type={result.type} />
              {alreadyWatchlisted ? (
                <Button size="sm" variant="outline" disabled>
                  <BookmarkCheckIcon className="mr-1 size-3" />
                  Watchlisted
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isAddingToWatchlist}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onAddToWatchlist(result, importedMediaId);
                  }}
                >
                  <BookmarkPlusIcon className="mr-1 size-3" />
                  Watchlist
                </Button>
              )}
              {alreadyProposed ? (
                <Button size="sm" variant="outline" className="cdb-imp-proposed" disabled>
                  <CheckIcon className="mr-1 size-3" />
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
                    void onPropose(result, importedMediaId);
                  }}
                >
                  <UsersIcon className="mr-1 size-3" />
                  Propose
                </Button>
              )}
              <ImportStatusButton
                isImported={isImported}
                isFromDatabase={isFromDatabase}
                isImporting={isImporting}
                onImport={() => {
                  void onImport(result);
                }}
              />
            </div>
          </div>
        );
      })}

      {/* Preview dialog for unimported results */}
      {previewResult !== null &&
        (() => {
          const previewKey = `${previewResult.source}-${String(previewResult.externalId)}`;
          const previewImportedId = importedMap.get(previewKey);
          const previewWatchlisted =
            locallyAdded.has(previewKey) ||
            isAlreadyWatchlisted(previewResult, previewImportedId, watchlistLookup);

          return (
            <MediaPreviewDialog
              open
              onOpenChange={(isOpen) => {
                if (!isOpen) setPreviewResult(null);
              }}
              result={previewResult}
              isImporting={isImporting}
              onImport={() => {
                void onImport(previewResult);
                setPreviewResult(null);
              }}
              isWatchlisted={previewWatchlisted}
              isAddingToWatchlist={isAddingToWatchlist}
              onAddToWatchlist={() => {
                void onAddToWatchlist(previewResult, previewImportedId);
              }}
            />
          );
        })()}
    </div>
  );
}
