"use client";

import { RefreshCwIcon, SparklesIcon, XIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";

import { DismissedItemsSheet } from "@/components/recommendations/dismissed-items-sheet";
import { RecommendationSection } from "@/components/recommendations/recommendation-section";
import { RecommendationToolsCard } from "@/components/recommendations/recommendation-tools-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { SimilarSourceInput } from "@/hooks/use-find-similar";
import { useFindSimilar } from "@/hooks/use-find-similar";
import {
  useDismissedRecommendations,
  useDismissRecommendation,
  useFilteredRecommendations,
  useRecommendationsByType,
  useRefreshRecommendations,
  useRefreshSection,
} from "@/hooks/use-recommendations";
import type { MediaSearchResult } from "@/types/media";
import type { RecommendationItem, RecommendationsMeta } from "@/types/recommendation-responses";

const MIN_RATINGS = 5;
const DISPLAY_LIMIT = 20;

type MediaTypeValue = "movie" | "tv" | "anime";

interface RecFilters {
  mediaTypes: MediaTypeValue[];
  genres: string[];
  decades: string[];
}

/** Toggle an item in an array — add if absent, remove if present */
function toggleItem<T>(array: T[], item: T): T[] {
  return array.includes(item) ? array.filter((element) => element !== item) : [...array, item];
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
  readonly onDismiss: (item: RecommendationItem) => void;
}

function PersonalizedSections({ onDismiss }: SectionProps) {
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
        onDismiss={onDismiss}
        onRefresh={() => {
          void tmdbRefresh.refresh();
        }}
        isRefreshing={tmdbRefresh.isRefreshing}
      />
    </>
  );
}

function FallbackSection({ onDismiss }: SectionProps) {
  const { data, isLoading } = useRecommendationsByType("content");
  const contentRefresh = useRefreshSection("content");

  return (
    <RecommendationSection
      title="Trending in Group"
      description="Popular picks from your group's recent sessions"
      items={(data?.items ?? []).slice(0, DISPLAY_LIMIT)}
      isLoading={isLoading}
      emptyMessage="Your group hasn't rated enough titles yet."
      onDismiss={onDismiss}
      onRefresh={() => {
        void contentRefresh.refresh();
      }}
      isRefreshing={contentRefresh.isRefreshing}
    />
  );
}

/**
 * Decides between personalized sections, fallback, or a loading skeleton.
 * Prevents the "Trending in Group" flash that appeared before meta loaded.
 */
function MainSections({
  meta,
  isPersonalized,
  onDismiss,
}: Readonly<{
  meta: RecommendationsMeta | undefined;
  isPersonalized: boolean;
  onDismiss: (item: RecommendationItem) => void;
}>) {
  if (meta === undefined) {
    return (
      <RecommendationSection
        title="For You"
        description="Based on genres and directors you rate highly"
        items={[]}
        isLoading={true}
        emptyMessage=""
        onDismiss={onDismiss}
      />
    );
  }
  if (isPersonalized) {
    return <PersonalizedSections onDismiss={onDismiss} />;
  }
  return <FallbackSection onDismiss={onDismiss} />;
}

function buildFilterDescription(filters: RecFilters): string {
  const parts: string[] = [];
  if (filters.genres.length > 0) parts.push(filters.genres.join(", "));
  if (filters.mediaTypes.length > 0) {
    const typeLabels: Record<string, string> = { movie: "movies", tv: "TV shows", anime: "anime" };
    parts.push(filters.mediaTypes.map((t) => typeLabels[t] ?? t).join(", "));
  }
  if (filters.decades.length > 0) {
    parts.push(filters.decades.map((d) => (d === "older" ? "pre-1980" : `${d}s`)).join(", "));
  }
  return parts.length > 0
    ? `Showing ${parts.join(" \u2022 ")} recommendations`
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
    mediaTypes: [],
    genres: [],
    decades: [],
  });

  // Find Similar state
  const [selectedSources, setSelectedSources] = useState<MediaSearchResult[]>([]);
  const {
    results: similarResults,
    isLoading: isSimilarLoading,
    findSimilar,
    reset: resetSimilar,
  } = useFindSimilar();
  const [isSimilarRefreshing, setIsSimilarRefreshing] = useState(false);

  // Store last-used sources for refresh
  const [lastSources, setLastSources] = useState<SimilarSourceInput[]>([]);

  const meta = groupData?.meta;
  const isPersonalized = meta?.isPersonalized ?? false;
  const ratingCount = meta?.ratingCount ?? 0;
  const ratingsNeeded = meta?.ratingsNeeded ?? MIN_RATINGS;
  const dismissedCount = dismissedData?.items.length ?? 0;

  const hasActiveFilters =
    filters.mediaTypes.length > 0 || filters.genres.length > 0 || filters.decades.length > 0;

  // Server-side filtered results — only fetched when filters are active
  const serverFilters = useMemo(
    () => ({
      mediaType: filters.mediaTypes.length > 0 ? filters.mediaTypes : undefined,
      genre: filters.genres.length > 0 ? filters.genres : undefined,
      decade: filters.decades.length > 0 ? filters.decades : undefined,
    }),
    [filters.mediaTypes, filters.genres, filters.decades],
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

  const handleFindSimilar = useCallback(
    (sources: SimilarSourceInput[]) => {
      setLastSources(sources);
      void findSimilar(sources);
    },
    [findSimilar],
  );

  const handleSimilarRefresh = useCallback(() => {
    if (lastSources.length === 0) return;
    setIsSimilarRefreshing(true);
    void findSimilar(lastSources).then(() => {
      setIsSimilarRefreshing(false);
    });
  }, [lastSources, findSimilar]);

  const handleSourcesChange = useCallback(
    (sources: MediaSearchResult[]) => {
      setSelectedSources(sources);
      // Reset results when sources change
      if (sources.length === 0) {
        resetSimilar();
        setLastSources([]);
      }
    },
    [resetSimilar],
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

      {/* Tools Card (Predict My Rating + Find Similar) */}
      <RecommendationToolsCard
        selectedSources={selectedSources}
        onSourcesChange={handleSourcesChange}
        onFindSimilar={handleFindSimilar}
        isSimilarLoading={isSimilarLoading}
        hasSimilarResults={similarResults.length > 0}
      />

      {/* Similar Titles results */}
      {(similarResults.length > 0 || isSimilarLoading) && (
        <RecommendationSection
          title="Similar Titles"
          description="Titles similar to your selected picks"
          items={similarResults.slice(0, DISPLAY_LIMIT)}
          isLoading={isSimilarLoading}
          emptyMessage="No similar titles found. Try different source titles."
          onDismiss={handleDismiss}
          onRefresh={handleSimilarRefresh}
          isRefreshing={isSimilarRefreshing}
        />
      )}

      {/* Filters */}
      <div className="space-y-3">
        {/* Type */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground w-14 text-xs font-medium">Type</span>
          {(
            [
              { value: "movie", label: "Movies" },
              { value: "tv", label: "TV Shows" },
              { value: "anime", label: "Anime" },
            ] as const
          ).map(({ value, label }) => (
            <Badge
              key={value}
              variant={filters.mediaTypes.includes(value) ? "default" : "outline"}
              className="cursor-pointer select-none"
              onClick={() => {
                setFilters((previous) => ({
                  ...previous,
                  mediaTypes: toggleItem(previous.mediaTypes, value),
                }));
              }}
            >
              {label}
              {filters.mediaTypes.includes(value) && <XIcon className="ml-1 size-3" />}
            </Badge>
          ))}
        </div>

        {/* Genre */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground w-14 text-xs font-medium">Genre</span>
          {availableGenres.map((genre) => (
            <Badge
              key={genre}
              variant={filters.genres.includes(genre) ? "default" : "outline"}
              className="cursor-pointer select-none"
              onClick={() => {
                setFilters((previous) => ({
                  ...previous,
                  genres: toggleItem(previous.genres, genre),
                }));
              }}
            >
              {genre}
              {filters.genres.includes(genre) && <XIcon className="ml-1 size-3" />}
            </Badge>
          ))}
        </div>

        {/* Era */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground w-14 text-xs font-medium">Era</span>
          {(
            [
              { value: "2020", label: "2020s" },
              { value: "2010", label: "2010s" },
              { value: "2000", label: "2000s" },
              { value: "1990", label: "1990s" },
              { value: "1980", label: "1980s" },
              { value: "older", label: "Pre-1980" },
            ] as const
          ).map(({ value, label }) => (
            <Badge
              key={value}
              variant={filters.decades.includes(value) ? "default" : "outline"}
              className="cursor-pointer select-none"
              onClick={() => {
                setFilters((previous) => ({
                  ...previous,
                  decades: toggleItem(previous.decades, value),
                }));
              }}
            >
              {label}
              {filters.decades.includes(value) && <XIcon className="ml-1 size-3" />}
            </Badge>
          ))}
        </div>

        {/* Clear all */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilters({ mediaTypes: [], genres: [], decades: [] });
            }}
          >
            <XIcon className="mr-1 size-3" />
            Clear all filters
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
            onDismiss={handleDismiss}
          />
        ) : (
          /* Unfiltered: show per-type sections */
          <>
            <MainSections meta={meta} isPersonalized={isPersonalized} onDismiss={handleDismiss} />

            {/* Group section (always shown) */}
            <RecommendationSection
              title="Group Pick"
              description="Titles everyone in the group would enjoy"
              items={(groupData?.items ?? []).slice(0, DISPLAY_LIMIT)}
              isLoading={groupLoading}
              emptyMessage="Need more group members with ratings to generate group recommendations."
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
