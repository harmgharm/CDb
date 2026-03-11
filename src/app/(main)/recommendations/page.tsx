"use client";

import { RefreshCwIcon, SparklesIcon, XIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";

import { DismissedItemsSheet } from "@/components/recommendations/dismissed-items-sheet";
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
import {
  useDismissedRecommendations,
  useDismissRecommendation,
  useFilteredRecommendations,
  useRecommendationsByType,
  useRefreshRecommendations,
  useRefreshSection,
} from "@/hooks/use-recommendations";
import type { RecommendationItem } from "@/types/recommendation-responses";

const MIN_RATINGS = 5;
const ALL_VALUE = "__all__";
const DISPLAY_LIMIT = 20;

type MediaTypeFilter = "movie" | "tv" | "anime" | "";

interface RecFilters {
  mediaType: MediaTypeFilter;
  genre: string;
  decade: string;
}

/** Collect unique genres from all recommendation items across all sections */
function collectGenres(dataSets: (RecommendationItem[] | undefined)[]): string[] {
  const genreSet = new Set<string>();
  for (const items of dataSets) {
    if (items === undefined) continue;
    for (const item of items) {
      for (const genre of item.genres) {
        genreSet.add(genre);
      }
    }
  }
  return [...genreSet].toSorted((a, b) => a.localeCompare(b));
}

interface SectionProps {
  readonly onWatchlistChange: () => void;
  readonly onDismiss: (item: RecommendationItem) => void;
}

function PersonalizedSections({ onWatchlistChange, onDismiss }: SectionProps) {
  const { data: contentData, isLoading: contentLoading } = useRecommendationsByType("content");
  const { data: collabData, isLoading: collabLoading } = useRecommendationsByType("collaborative");
  const { data: tmdbData, isLoading: tmdbLoading } = useRecommendationsByType("tmdb");

  const contentRefresh = useRefreshSection("content");
  const collabRefresh = useRefreshSection("collaborative");
  const tmdbRefresh = useRefreshSection("tmdb");

  return (
    <>
      <RecommendationSection
        title="For You"
        description="Based on genres and directors you rate highly"
        items={(contentData?.items ?? []).slice(0, DISPLAY_LIMIT)}
        isLoading={contentLoading}
        emptyMessage="Rate more titles to get genre-based recommendations."
        onWatchlistChange={onWatchlistChange}
        onDismiss={onDismiss}
        onRefresh={() => {
          void contentRefresh.refresh();
        }}
        isRefreshing={contentRefresh.isRefreshing}
      />

      <RecommendationSection
        title="Similar Tastes"
        description="Users with similar ratings also loved these"
        items={(collabData?.items ?? []).slice(0, DISPLAY_LIMIT)}
        isLoading={collabLoading}
        emptyMessage="Not enough shared ratings with other users yet."
        onWatchlistChange={onWatchlistChange}
        onDismiss={onDismiss}
        onRefresh={() => {
          void collabRefresh.refresh();
        }}
        isRefreshing={collabRefresh.isRefreshing}
      />

      <RecommendationSection
        title="Because You Loved..."
        description="Recommended based on your top-rated titles"
        items={(tmdbData?.items ?? []).slice(0, DISPLAY_LIMIT)}
        isLoading={tmdbLoading}
        emptyMessage="Rate some titles 8+ to get TMDB-powered suggestions."
        onWatchlistChange={onWatchlistChange}
        onDismiss={onDismiss}
        onRefresh={() => {
          void tmdbRefresh.refresh();
        }}
        isRefreshing={tmdbRefresh.isRefreshing}
      />
    </>
  );
}

function FallbackSection({ onWatchlistChange, onDismiss }: SectionProps) {
  const { data, isLoading } = useRecommendationsByType("content");
  const contentRefresh = useRefreshSection("content");

  return (
    <RecommendationSection
      title="Trending in Group"
      description="Popular picks from your group's recent sessions"
      items={(data?.items ?? []).slice(0, DISPLAY_LIMIT)}
      isLoading={isLoading}
      emptyMessage="Your group hasn't rated enough titles yet."
      onWatchlistChange={onWatchlistChange}
      onDismiss={onDismiss}
      onRefresh={() => {
        void contentRefresh.refresh();
      }}
      isRefreshing={contentRefresh.isRefreshing}
    />
  );
}

function buildFilterDescription(filters: RecFilters): string {
  const parts: string[] = [];
  if (filters.genre.length > 0) parts.push(filters.genre);
  if (filters.mediaType.length > 0) {
    const typeLabels: Record<string, string> = { movie: "movies", tv: "TV shows", anime: "anime" };
    parts.push(typeLabels[filters.mediaType] ?? filters.mediaType);
  }
  if (filters.decade.length > 0) {
    parts.push(filters.decade === "older" ? "pre-1980" : `${filters.decade}s`);
  }
  return parts.length > 0
    ? `Showing ${parts.join(" ")} recommendations`
    : "Filtered recommendations";
}

export default function RecommendationsPage() {
  const { data: groupData, isLoading: groupLoading } = useRecommendationsByType("group");
  const { data: contentData } = useRecommendationsByType("content");
  const { data: collabData } = useRecommendationsByType("collaborative");
  const { data: tmdbData } = useRecommendationsByType("tmdb");
  const { refresh, isRefreshing } = useRefreshRecommendations();
  const groupRefresh = useRefreshSection("group");
  const { data: dismissedData } = useDismissedRecommendations();
  const { dismiss } = useDismissRecommendation();
  const { mutate } = useSWRConfig();
  const [filters, setFilters] = useState<RecFilters>({
    mediaType: "",
    genre: "",
    decade: "",
  });

  const meta = groupData?.meta;
  const isPersonalized = meta?.isPersonalized ?? false;
  const ratingCount = meta?.ratingCount ?? 0;
  const ratingsNeeded = meta?.ratingsNeeded ?? MIN_RATINGS;
  const dismissedCount = dismissedData?.items.length ?? 0;

  const hasActiveFilters =
    filters.mediaType.length > 0 || filters.genre.length > 0 || filters.decade.length > 0;

  // Server-side filtered results — only fetched when filters are active
  const serverFilters = useMemo(
    () => ({
      mediaType: filters.mediaType.length > 0 ? filters.mediaType : undefined,
      genre: filters.genre.length > 0 ? filters.genre : undefined,
      decade: filters.decade.length > 0 ? filters.decade : undefined,
    }),
    [filters.mediaType, filters.genre, filters.decade],
  );
  const { data: filteredData, isLoading: filteredLoading } =
    useFilteredRecommendations(serverFilters);

  const progressPercent = useMemo(
    () => Math.min(100, Math.round((ratingCount / MIN_RATINGS) * 100)),
    [ratingCount],
  );

  // Always collect genres from unfiltered data (so dropdown stays populated)
  const availableGenres = useMemo(
    () => collectGenres([contentData?.items, collabData?.items, tmdbData?.items, groupData?.items]),
    [contentData?.items, collabData?.items, tmdbData?.items, groupData?.items],
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

  const handleDismiss = useCallback(
    (item: RecommendationItem) => {
      void dismiss({
        mediaId: item.mediaId ?? undefined,
        tmdbId: item.tmdbId ?? undefined,
        malId: item.malId ?? undefined,
        extTitle: item.title,
        extPosterUrl: item.posterUrl,
        extMediaType: item.mediaType,
      }).then((success) => {
        if (success) {
          toast.success(`"${item.title}" dismissed`);
        }
      });
    },
    [dismiss],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recommendations</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Personalized suggestions for you and your group
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DismissedItemsSheet dismissedCount={dismissedCount} />
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCwIcon className={`mr-2 size-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh All
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.mediaType.length > 0 ? filters.mediaType : ALL_VALUE}
          onValueChange={(value) => {
            setFilters((previous) => ({
              ...previous,
              mediaType: value === ALL_VALUE ? "" : (value as MediaTypeFilter),
            }));
          }}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All types</SelectItem>
            <SelectItem value="movie">Movies</SelectItem>
            <SelectItem value="tv">TV Shows</SelectItem>
            <SelectItem value="anime">Anime</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.genre.length > 0 ? filters.genre : ALL_VALUE}
          onValueChange={(value) => {
            setFilters((previous) => ({ ...previous, genre: value === ALL_VALUE ? "" : value }));
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All genres" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All genres</SelectItem>
            {availableGenres.map((genre) => (
              <SelectItem key={genre} value={genre}>
                {genre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.decade.length > 0 ? filters.decade : ALL_VALUE}
          onValueChange={(value) => {
            setFilters((previous) => ({ ...previous, decade: value === ALL_VALUE ? "" : value }));
          }}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Any era" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Any era</SelectItem>
            <SelectItem value="2020">2020s</SelectItem>
            <SelectItem value="2010">2010s</SelectItem>
            <SelectItem value="2000">2000s</SelectItem>
            <SelectItem value="1990">1990s</SelectItem>
            <SelectItem value="1980">1980s</SelectItem>
            <SelectItem value="older">Pre-1980</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters({ mediaType: "", genre: "", decade: "" });
            }}
          >
            <XIcon className="mr-1 size-3" />
            Clear
          </Button>
        )}
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
      <div className="space-y-10">
        {hasActiveFilters ? (
          /* Server-side filtered: single section with full results */
          <RecommendationSection
            title="Filtered Results"
            description={buildFilterDescription(filters)}
            items={(filteredData?.items ?? []).slice(0, DISPLAY_LIMIT)}
            isLoading={filteredLoading}
            emptyMessage="No recommendations match your filters. Try adjusting or clearing them."
            onWatchlistChange={handleWatchlistChange}
            onDismiss={handleDismiss}
          />
        ) : (
          /* Unfiltered: show per-type sections */
          <>
            {isPersonalized ? (
              <PersonalizedSections
                onWatchlistChange={handleWatchlistChange}
                onDismiss={handleDismiss}
              />
            ) : (
              <FallbackSection
                onWatchlistChange={handleWatchlistChange}
                onDismiss={handleDismiss}
              />
            )}

            {/* Group section (always shown) */}
            <RecommendationSection
              title="Group Pick"
              description="Titles everyone in the group would enjoy"
              items={(groupData?.items ?? []).slice(0, DISPLAY_LIMIT)}
              isLoading={groupLoading}
              emptyMessage="Need more group members with ratings to generate group recommendations."
              onWatchlistChange={handleWatchlistChange}
              onDismiss={handleDismiss}
              onRefresh={() => {
                void groupRefresh.refresh();
              }}
              isRefreshing={groupRefresh.isRefreshing}
            />
          </>
        )}
      </div>
    </div>
  );
}
