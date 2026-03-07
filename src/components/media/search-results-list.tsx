"use client";

import {
  BookmarkCheckIcon,
  BookmarkPlusIcon,
  CheckIcon,
  DownloadIcon,
  LoaderIcon,
} from "lucide-react";

import { MediaInfoRow } from "@/components/media/media-card";
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

interface SearchResultsListProps {
  readonly isSearching: boolean;
  readonly query: string;
  readonly results: MediaSearchResult[];
  readonly importedMap: Map<string, string>;
  readonly locallyAdded: Set<string>;
  readonly watchlistLookup: WatchlistLookup;
  readonly isAddingToWatchlist: boolean;
  readonly isImporting: boolean;
  readonly onImport: (result: MediaSearchResult) => Promise<void>;
  readonly onAddToWatchlist: (
    result: MediaSearchResult,
    importedMediaId: string | undefined,
  ) => Promise<void>;
  readonly onNavigate: (mediaId: string) => void;
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
  onImport,
  onAddToWatchlist,
  onNavigate,
}: SearchResultsListProps) {
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

        return (
          <div
            key={key}
            role={isImported ? "link" : undefined}
            tabIndex={isImported ? 0 : undefined}
            className={`hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-3 transition-colors ${
              isImported ? "cursor-pointer" : ""
            }`}
            onClick={() => {
              if (isImported) onNavigate(importedMediaId);
            }}
            onKeyDown={(event) => {
              if (isImported && (event.key === "Enter" || event.key === " ")) {
                onNavigate(importedMediaId);
              }
            }}
          >
            <div className="min-w-0 flex-1">
              <MediaInfoRow
                posterUrl={result.posterUrl}
                title={result.title}
                type={result.type}
                releaseYear={result.releaseYear}
                overview={result.overview}
              />
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
              {importedMediaId === undefined ? (
                <Button
                  size="sm"
                  disabled={isImporting}
                  onClick={() => {
                    void onImport(result);
                  }}
                >
                  {isImporting ? (
                    <LoaderIcon className="mr-1 size-3 animate-spin" />
                  ) : (
                    <DownloadIcon className="mr-1 size-3" />
                  )}
                  Import
                </Button>
              ) : (
                <Button size="sm" variant="outline">
                  <CheckIcon className="mr-1 size-3" />
                  Added
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
