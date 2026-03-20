"use client";

import { Loader2Icon, SearchIcon, Trash2Icon } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { PredictionSearchItem } from "@/components/predictions/prediction-search-item";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SimilarSourceInput } from "@/hooks/use-find-similar";
import { useMediaSearch } from "@/hooks/use-media";
import type { MediaSearchResult } from "@/types/media";

import { SelectedSourceChip } from "./selected-source-chip";

const DEBOUNCE_MS = 400;
const MAX_SOURCES = 5;

function getButtonLabel(isLoading: boolean, hasResults: boolean): React.ReactNode {
  if (isLoading) {
    return (
      <>
        <Loader2Icon className="mr-2 size-3.5 animate-spin" />
        <span>Searching...</span>
      </>
    );
  }
  if (hasResults) {
    return <span>Refresh Results</span>;
  }
  return <span>Find Similar</span>;
}

interface FindSimilarContentProps {
  readonly selectedSources: MediaSearchResult[];
  readonly onSourcesChange: (sources: MediaSearchResult[]) => void;
  readonly onFindSimilar: (sources: SimilarSourceInput[]) => void;
  readonly isLoading: boolean;
  readonly hasResults: boolean;
}

export function FindSimilarContent({
  selectedSources,
  onSourcesChange,
  onFindSimilar,
  isLoading,
  hasResults,
}: FindSimilarContentProps) {
  const [query, setQuery] = useState("");
  const { results, isSearching, search, clearResults } = useMediaSearch();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim().length === 0) {
      clearResults();
      return;
    }

    debounceRef.current = setTimeout(() => {
      void search(query);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, search, clearResults]);

  const handleSelect = useCallback(
    (item: MediaSearchResult) => {
      // Prevent duplicates (by source + externalId)
      const isDuplicate = selectedSources.some(
        (source) => source.source === item.source && source.externalId === item.externalId,
      );
      if (isDuplicate) return;

      onSourcesChange([...selectedSources, item]);
      setQuery("");
      clearResults();
    },
    [selectedSources, onSourcesChange, clearResults],
  );

  const handleRemove = useCallback(
    (index: number) => {
      onSourcesChange(selectedSources.filter((_, filterIndex) => filterIndex !== index));
    },
    [selectedSources, onSourcesChange],
  );

  const handleClearAll = useCallback(() => {
    onSourcesChange([]);
  }, [onSourcesChange]);

  const handleFindSimilar = useCallback(() => {
    const sources: SimilarSourceInput[] = selectedSources.map((item) => ({
      tmdbId: item.source === "tmdb" ? item.externalId : undefined,
      malId: item.source === "jikan" ? item.externalId : undefined,
      mediaType: item.type,
      title: item.title,
    }));
    onFindSimilar(sources);
  }, [selectedSources, onFindSimilar]);

  const canSearch = selectedSources.length < MAX_SOURCES;
  const showSearchResults = query.trim().length > 0 && results.length > 0;

  // Filter out already-selected items from search results
  const filteredResults = results.filter(
    (item) =>
      !selectedSources.some(
        (source) => source.source === item.source && source.externalId === item.externalId,
      ),
  );

  return (
    <div className="space-y-4">
      {/* Selected sources */}
      {selectedSources.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs font-medium">
              {String(selectedSources.length)}/{String(MAX_SOURCES)} titles selected
            </span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleClearAll}>
              <Trash2Icon className="mr-1 size-3" />
              Clear all
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedSources.map((source, index) => (
              <SelectedSourceChip
                key={`${source.source}-${String(source.externalId)}`}
                source={source}
                onRemove={() => {
                  handleRemove(index);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Search input */}
      {canSearch && (
        <div className="relative">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder={
              selectedSources.length === 0
                ? "Search for titles to find similar..."
                : "Add another title..."
            }
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            className="pl-9"
          />
          {isSearching && (
            <Loader2Icon className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
          )}
        </div>
      )}

      {/* Search results */}
      {showSearchResults && filteredResults.length > 0 && (
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
          {filteredResults.map((item) => (
            <PredictionSearchItem
              key={`${item.source}-${String(item.externalId)}`}
              item={item}
              onClick={() => {
                handleSelect(item);
              }}
            />
          ))}
        </div>
      )}

      {/* No search results */}
      {query.trim().length > 0 && !isSearching && results.length === 0 && (
        <p className="text-muted-foreground py-4 text-center text-sm">
          No results found. Try a different search term.
        </p>
      )}

      {/* Action buttons */}
      {selectedSources.length > 0 && (
        <div className="flex justify-center">
          <Button onClick={handleFindSimilar} disabled={isLoading} size="sm">
            {getButtonLabel(isLoading, hasResults)}
          </Button>
        </div>
      )}
    </div>
  );
}
