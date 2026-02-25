"use client";

import { CheckIcon, DownloadIcon, LoaderIcon, SearchIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { MediaInfoRow } from "@/components/media/media-card";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMediaImport, useMediaSearch } from "@/hooks/use-media";
import type { MediaSearchResult } from "@/types/media";

const ALL_VALUE = "__all__";

interface ImportMediaDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSuccess: () => void;
}

export function ImportMediaDialog({ open, onOpenChange, onSuccess }: ImportMediaDialogProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const { results, isSearching, searchError, search, clearResults } = useMediaSearch();
  const { isImporting, importError, importMedia } = useMediaImport();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);

      if (debounceRef.current !== undefined) {
        clearTimeout(debounceRef.current);
      }

      if (value.trim().length === 0) {
        clearResults();
        return;
      }

      debounceRef.current = setTimeout(() => {
        void search(value, typeFilter.length > 0 ? typeFilter : undefined);
      }, 400);
    },
    [typeFilter, search, clearResults],
  );

  const handleTypeChange = useCallback(
    (value: string) => {
      const newType = value === ALL_VALUE ? "" : value;
      setTypeFilter(newType);
      if (query.trim().length > 0) {
        void search(query, newType.length > 0 ? newType : undefined);
      }
    },
    [query, search],
  );

  const handleImport = useCallback(
    async (result: MediaSearchResult) => {
      const params: { type: string; tmdbId?: number; malId?: number } = {
        type: result.type,
      };

      if (result.source === "tmdb") {
        params.tmdbId = result.externalId;
      } else {
        params.malId = result.externalId;
      }

      const success = await importMedia(params);

      if (success) {
        const key = `${result.source}-${String(result.externalId)}`;
        setImportedIds((previous) => new Set([...previous, key]));
        toast.success(`Imported "${result.title}"`);
        onSuccess();
      }
    },
    [importMedia, onSuccess],
  );

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        setQuery("");
        setTypeFilter("");
        setImportedIds(new Set());
        clearResults();
      }
      onOpenChange(isOpen);
    },
    [onOpenChange, clearResults],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Media</DialogTitle>
          <DialogDescription>
            Search TMDB and MyAnimeList to import movies, shows, and anime.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search for a title..."
              value={query}
              onChange={(event) => {
                handleSearch(event.target.value);
              }}
              className="pl-9"
              autoFocus
            />
          </div>
          <Select
            value={typeFilter.length > 0 ? typeFilter : ALL_VALUE}
            onValueChange={handleTypeChange}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_VALUE}>All types</SelectItem>
              <SelectItem value="movie">Movies</SelectItem>
              <SelectItem value="tv">TV Shows</SelectItem>
              <SelectItem value="anime">Anime</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(searchError !== null || importError !== null) && (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            {searchError ?? importError}
          </div>
        )}

        <div className="max-h-[50vh] overflow-y-auto">
          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <LoaderIcon className="text-muted-foreground size-5 animate-spin" />
              <span className="text-muted-foreground ml-2 text-sm">Searching...</span>
            </div>
          )}

          {!isSearching && query.length > 0 && results.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No results found for &ldquo;{query}&rdquo;
            </p>
          )}

          {!isSearching && results.length > 0 && (
            <div className="space-y-2">
              {results.map((result) => {
                const key = `${result.source}-${String(result.externalId)}`;
                const isImported = importedIds.has(key);

                return (
                  <div
                    key={key}
                    className="hover:bg-accent/50 flex items-center gap-3 rounded-lg border p-3 transition-colors"
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
                      {isImported ? (
                        <Button size="sm" variant="outline" disabled>
                          <CheckIcon className="mr-1 size-3" />
                          Added
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={isImporting}
                          onClick={() => {
                            void handleImport(result);
                          }}
                        >
                          {isImporting ? (
                            <LoaderIcon className="mr-1 size-3 animate-spin" />
                          ) : (
                            <DownloadIcon className="mr-1 size-3" />
                          )}
                          Import
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isSearching && query.length === 0 && results.length === 0 && (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Start typing to search for movies, TV shows, or anime.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
