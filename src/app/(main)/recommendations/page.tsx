"use client";

import { RefreshCwIcon, SparklesIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useSWRConfig } from "swr";

import { RecommendationSection } from "@/components/recommendations/recommendation-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRecommendationsByType, useRefreshRecommendations } from "@/hooks/use-recommendations";
import type { RecommendationItem } from "@/types/recommendation-responses";

const MIN_RATINGS = 5;
const ALL_TYPES = "__all__";
const DISPLAY_LIMIT = 20;

type MediaTypeFilter = "movie" | "tv" | "anime" | "";

/**
 * Apply media type filter and limit results.
 * When no filter is active ("All types"), shows top items by score with a minimum
 * representation guarantee so no type with results is completely absent.
 * When a specific type is selected, returns up to DISPLAY_LIMIT of that type.
 */
function filterItems(
  items: RecommendationItem[],
  mediaType: MediaTypeFilter,
): RecommendationItem[] {
  if (mediaType.length > 0) {
    return items.filter((item) => item.mediaType === mediaType).slice(0, DISPLAY_LIMIT);
  }

  // "All types" — score-driven with minimum representation per type
  const byType = new Map<string, RecommendationItem[]>();
  for (const item of items) {
    const group = byType.get(item.mediaType) ?? [];
    group.push(item);
    byType.set(item.mediaType, group);
  }

  const typeCount = byType.size;
  if (typeCount === 0) return [];

  // Guarantee each type with results gets at least this many slots
  const minPerType = Math.max(1, Math.floor(3 / typeCount) + 1);
  const result: RecommendationItem[] = [];

  // First pass: guarantee minimum representation from each type
  for (const group of byType.values()) {
    result.push(...group.slice(0, minPerType));
  }

  // Second pass: fill remaining slots from all items by score (natural ranking)
  const resultIds = new Set(
    result.map((r) => r.mediaId ?? `${String(r.tmdbId)}-${String(r.malId)}`),
  );
  const remaining = items.filter((item) => {
    const key = item.mediaId ?? `${String(item.tmdbId)}-${String(item.malId)}`;
    return !resultIds.has(key);
  });

  result.push(...remaining.slice(0, DISPLAY_LIMIT - result.length));
  return result.slice(0, DISPLAY_LIMIT);
}

interface SectionProps {
  readonly onWatchlistChange: () => void;
  readonly mediaTypeFilter: MediaTypeFilter;
}

function PersonalizedSections({ onWatchlistChange, mediaTypeFilter }: SectionProps) {
  const { data: contentData, isLoading: contentLoading } = useRecommendationsByType("content");
  const { data: collabData, isLoading: collabLoading } = useRecommendationsByType("collaborative");
  const { data: tmdbData, isLoading: tmdbLoading } = useRecommendationsByType("tmdb");

  return (
    <>
      <RecommendationSection
        title="For You"
        description="Based on genres and directors you rate highly"
        items={filterItems(contentData?.items ?? [], mediaTypeFilter)}
        isLoading={contentLoading}
        emptyMessage="Rate more titles to get genre-based recommendations."
        onWatchlistChange={onWatchlistChange}
      />

      <RecommendationSection
        title="Similar Tastes"
        description="Users with similar ratings also loved these"
        items={filterItems(collabData?.items ?? [], mediaTypeFilter)}
        isLoading={collabLoading}
        emptyMessage="Not enough shared ratings with other users yet."
        onWatchlistChange={onWatchlistChange}
      />

      <RecommendationSection
        title="Because You Loved..."
        description="Recommended based on your top-rated titles"
        items={filterItems(tmdbData?.items ?? [], mediaTypeFilter)}
        isLoading={tmdbLoading}
        emptyMessage="Rate some titles 8+ to get TMDB-powered suggestions."
        onWatchlistChange={onWatchlistChange}
      />
    </>
  );
}

function FallbackSection({ onWatchlistChange, mediaTypeFilter }: SectionProps) {
  const { data, isLoading } = useRecommendationsByType("content");

  return (
    <RecommendationSection
      title="Trending in Group"
      description="Popular picks from your group's recent sessions"
      items={filterItems(data?.items ?? [], mediaTypeFilter)}
      isLoading={isLoading}
      emptyMessage="Your group hasn't rated enough titles yet."
      onWatchlistChange={onWatchlistChange}
    />
  );
}

export default function RecommendationsPage() {
  const { data: groupData, isLoading: groupLoading } = useRecommendationsByType("group");
  const { refresh, isRefreshing } = useRefreshRecommendations();
  const { mutate } = useSWRConfig();
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaTypeFilter>("");

  // Use group data's meta to determine personalization state
  // (all types return the same meta from the API)
  const meta = groupData?.meta;
  const isPersonalized = meta?.isPersonalized ?? false;
  const ratingCount = meta?.ratingCount ?? 0;
  const ratingsNeeded = meta?.ratingsNeeded ?? MIN_RATINGS;

  const progressPercent = useMemo(
    () => Math.min(100, Math.round((ratingCount / MIN_RATINGS) * 100)),
    [ratingCount],
  );

  const handleRefresh = useCallback(() => {
    void refresh().then(() => {
      void mutate(
        (key: string) => typeof key === "string" && key.startsWith("/api/recommendations"),
      );
    });
  }, [refresh, mutate]);

  const handleWatchlistChange = useCallback(() => {
    void mutate((key: string) => typeof key === "string" && key.startsWith("/api/recommendations"));
  }, [mutate]);

  const filteredGroupItems = useMemo(
    () => filterItems(groupData?.items ?? [], mediaTypeFilter),
    [groupData?.items, mediaTypeFilter],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recommendations</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Personalized suggestions for you and your group
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={mediaTypeFilter.length > 0 ? mediaTypeFilter : ALL_TYPES}
            onValueChange={(value) => {
              setMediaTypeFilter(value === ALL_TYPES ? "" : (value as MediaTypeFilter));
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TYPES}>All types</SelectItem>
              <SelectItem value="movie">Movies</SelectItem>
              <SelectItem value="tv">TV Shows</SelectItem>
              <SelectItem value="anime">Anime</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCwIcon className={`mr-2 size-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Progress banner for users with < 5 ratings */}
      {!isPersonalized && meta !== undefined && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-4 pt-6">
            <SparklesIcon className="text-primary size-8 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Rate {String(ratingsNeeded)} more title{ratingsNeeded === 1 ? "" : "s"} to unlock
                  personalized recommendations
                </p>
                <Badge variant="secondary" className="ml-2 shrink-0">
                  {String(ratingCount)}/{String(MIN_RATINGS)}
                </Badge>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sections */}
      {isPersonalized ? (
        <PersonalizedSections
          onWatchlistChange={handleWatchlistChange}
          mediaTypeFilter={mediaTypeFilter}
        />
      ) : (
        <FallbackSection
          onWatchlistChange={handleWatchlistChange}
          mediaTypeFilter={mediaTypeFilter}
        />
      )}

      {/* Group section (always shown) */}
      <RecommendationSection
        title="Group Pick"
        description="Titles everyone in the group would enjoy"
        items={filteredGroupItems}
        isLoading={groupLoading}
        emptyMessage="Need more group members with ratings to generate group recommendations."
        onWatchlistChange={handleWatchlistChange}
      />
    </div>
  );
}
