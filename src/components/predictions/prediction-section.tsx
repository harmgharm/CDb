"use client";

import { Loader2Icon, RotateCcwIcon, SearchIcon, SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useMediaSearch } from "@/hooks/use-media";
import { usePrediction } from "@/hooks/use-predictions";
import type { MediaSearchResult } from "@/types/media";

import { PredictionResultCard } from "./prediction-result-card";
import { PredictionSearchItem } from "./prediction-search-item";
import { PredictionSkeleton } from "./prediction-skeleton";

const DEBOUNCE_MS = 400;

/**
 * Inner content for the prediction feature — search, results, and result card.
 * Used inside the tabbed tools card on the recommendations page.
 */
export function PredictionContent() {
  const [query, setQuery] = useState("");
  const { results, isSearching, search, clearResults } = useMediaSearch();
  const { result, isPredicting, predictionError, predict, reset } = usePrediction();
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
      setQuery("");
      clearResults();

      void predict({
        tmdbId: item.source === "tmdb" ? item.externalId : undefined,
        malId: item.source === "jikan" ? item.externalId : undefined,
        mediaId: item.existingMediaId,
        mediaType: item.type,
      });
    },
    [predict, clearResults],
  );

  const handleReset = useCallback(() => {
    reset();
    setQuery("");
    clearResults();
  }, [reset, clearResults]);

  const showSearchResults =
    query.trim().length > 0 && results.length > 0 && result === null && !isPredicting;

  return (
    <div className="space-y-4">
      {/* Search input (hidden when showing result) */}
      {result === null && !isPredicting && (
        <div className="relative">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search for a movie, show, or anime..."
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
      {showSearchResults && (
        <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
          {results.map((item) => (
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

      {/* No results */}
      {query.trim().length > 0 &&
        !isSearching &&
        results.length === 0 &&
        result === null &&
        !isPredicting && (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No results found. Try a different search term.
          </p>
        )}

      {/* Loading skeleton */}
      {isPredicting && <PredictionSkeleton />}

      {/* Error */}
      {predictionError !== null && (
        <div className="text-destructive py-4 text-center text-sm">
          {predictionError}
          <Button variant="ghost" size="sm" onClick={handleReset} className="ml-2">
            Try again
          </Button>
        </div>
      )}

      {/* Prediction result */}
      {result !== null && (
        <div className="space-y-4">
          <PredictionResultCard prediction={result} />
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcwIcon className="mr-2 size-3.5" />
              Predict Another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Standalone prediction card — wraps PredictionContent in its own Card. */
export function PredictionSection() {
  return (
    <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-transparent">
      <CardHeader>
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-5 text-indigo-400" />
          <CardTitle className="text-lg">Predict My Rating</CardTitle>
        </div>
        <CardDescription>
          Search for any title to see your predicted rating based on your taste profile
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PredictionContent />
      </CardContent>
    </Card>
  );
}
