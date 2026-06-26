"use client";

import { RefreshCwIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";

import type { FilterSegment } from "@/components/editorial/conversational-filters";
import { ConversationalFilters } from "@/components/editorial/conversational-filters";
import { EditorialMasthead } from "@/components/editorial/editorial-masthead";
import { useAuth } from "@/components/providers/auth-provider";
import { DismissedItemsSheet } from "@/components/recommendations/dismissed-items-sheet";
import { FriendStack } from "@/components/recommendations/friend-stack";
import {
  NumberedSection,
  sectionNumber,
  SourceTag,
} from "@/components/recommendations/numbered-section";
import { RecommendationSection } from "@/components/recommendations/recommendation-section";
import { RecommendationToolsCard } from "@/components/recommendations/recommendation-tools-card";
import { WarmingUpBanner } from "@/components/recommendations/warming-up-banner";
import { Button } from "@/components/ui/button";
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
// Import the constant from the leaf module, not the barrel: the barrel
// re-exports server-only cache/db code that drags env validation into the
// client bundle. types.ts is type-only and client-safe.
import { MIN_RATINGS_FOR_PERSONALIZED } from "@/lib/recommendations/types";
import type { MediaSearchResult } from "@/types/media";
import type {
  FriendWatch,
  RecommendationItem,
  RecommendationsResponse,
} from "@/types/recommendation-responses";

const DISPLAY_LIMIT = 20;
const COLLAGE_POSTER_COUNT = 5;

type MediaTypeValue = "movie" | "tv" | "anime";

interface RecFilters {
  mediaTypes: MediaTypeValue[];
  genres: string[];
  decades: string[];
}

/** Type filter words. */
const TYPE_OPTIONS = [
  { value: "movie", word: "movies", ariaLabel: "Toggle movies" },
  { value: "tv", word: "tv", ariaLabel: "Toggle TV shows" },
  { value: "anime", word: "anime", ariaLabel: "Toggle anime" },
] as const;

/** Era filter words, matching the previous decade chips. */
const ERA_OPTIONS = [
  { value: "2020", word: "2020s", ariaLabel: "Toggle the 2020s" },
  { value: "2010", word: "2010s", ariaLabel: "Toggle the 2010s" },
  { value: "2000", word: "2000s", ariaLabel: "Toggle the 2000s" },
  { value: "1990", word: "1990s", ariaLabel: "Toggle the 1990s" },
  { value: "1980", word: "1980s", ariaLabel: "Toggle the 1980s" },
  { value: "older", word: "pre-1980", ariaLabel: "Toggle pre-1980 titles" },
] as const;

/** Toggle an item in an array — add if absent, remove if present. */
function toggleItem<T>(array: T[], item: T): T[] {
  return array.includes(item) ? array.filter((element) => element !== item) : [...array, item];
}

/** Collect unique genres from all recommendation items across all sections. */
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

/** Dedupe the friends who drove a collaborative section, keyed by username. */
function collectFriends(items: RecommendationItem[] | undefined): FriendWatch[] {
  if (items === undefined) return [];
  const byUsername = new Map<string, FriendWatch>();
  for (const item of items) {
    for (const friend of item.watchedByFriends ?? []) {
      if (!byUsername.has(friend.username)) byUsername.set(friend.username, friend);
    }
  }
  return [...byUsername.values()];
}

/** First N non-null poster URLs across the given sections, for the warmup collage. */
function collectPosters(
  dataSets: (RecommendationItem[] | undefined)[],
  count: number,
): (string | null)[] {
  const posters: (string | null)[] = [];
  for (const items of dataSets) {
    for (const item of items ?? []) {
      if (item.posterUrl !== null && !posters.includes(item.posterUrl)) {
        posters.push(item.posterUrl);
        if (posters.length === count) return posters;
      }
    }
  }
  while (posters.length < count) posters.push(null);
  return posters;
}

function buildFilterDescription(filters: RecFilters): string {
  const parts: string[] = [];
  if (filters.genres.length > 0) parts.push(filters.genres.join(", "));
  if (filters.mediaTypes.length > 0) {
    // Sentence-form lowercase plurals — a distinct grammatical form from the
    // canonical MEDIA_TYPE_LABELS ("Movie"/"TV Show"/"Anime"), kept local
    // because "anime" doesn't pluralize and the casing differs mid-sentence.
    const typeLabels: Record<string, string> = { movie: "movies", tv: "TV shows", anime: "anime" };
    parts.push(filters.mediaTypes.map((t) => typeLabels[t] ?? t).join(", "));
  }
  if (filters.decades.length > 0) {
    parts.push(filters.decades.map((d) => (d === "older" ? "pre-1980" : `${d}s`)).join(", "));
  }
  return parts.length > 0
    ? `Showing ${parts.join(" • ")} recommendations`
    : "Filtered recommendations";
}

/** A personalized or fallback section, with everything its numbered chrome needs. */
interface SectionDescriptor {
  key: string;
  title: string;
  description: string;
  data: RecommendationsResponse | undefined;
  isLoading: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
  aside?: React.ReactNode;
}

export default function RecommendationsPage() {
  const { user } = useAuth();

  // Per-type recommendation data (hooks unchanged from the previous page).
  const content = useRecommendationsByType("content");
  const collab = useRecommendationsByType("collaborative");
  const tmdb = useRecommendationsByType("tmdb");
  const group = useRecommendationsByType("group");

  const contentRefresh = useRefreshSection("content");
  const collabRefresh = useRefreshSection("collaborative");
  const tmdbRefresh = useRefreshSection("tmdb");
  const groupRefresh = useRefreshSection("group");

  const { refresh, isRefreshing } = useRefreshRecommendations();
  const { data: dismissedData } = useDismissedRecommendations();
  const { dismiss } = useDismissRecommendation();
  const { mutate } = useSWRConfig();

  const [filters, setFilters] = useState<RecFilters>({
    mediaTypes: [],
    genres: [],
    decades: [],
  });

  // Find Similar state (unchanged — the tools card is presentation-reused as-is).
  const [selectedSources, setSelectedSources] = useState<MediaSearchResult[]>([]);
  const {
    results: similarResults,
    isLoading: isSimilarLoading,
    findSimilar,
    reset: resetSimilar,
  } = useFindSimilar();
  const [isSimilarRefreshing, setIsSimilarRefreshing] = useState(false);
  const [lastSources, setLastSources] = useState<SimilarSourceInput[]>([]);

  const meta = group.data?.meta;
  const isPersonalized = meta?.isPersonalized ?? false;
  const ratingCount = meta?.ratingCount ?? 0;
  const ratingsNeeded = meta?.ratingsNeeded ?? MIN_RATINGS_FOR_PERSONALIZED;
  const dismissedCount = dismissedData?.items.length ?? 0;

  const hasActiveFilters =
    filters.mediaTypes.length > 0 || filters.genres.length > 0 || filters.decades.length > 0;

  // Server-side filtered results — only fetched when filters are active.
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

  // Genres for the filter sentence, from unfiltered data so they stay populated.
  const availableGenres = useMemo(
    () =>
      collectGenres([content.data?.items, collab.data?.items, tmdb.data?.items, group.data?.items]),
    [content.data?.items, collab.data?.items, tmdb.data?.items, group.data?.items],
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
      if (sources.length === 0) {
        resetSimilar();
        setLastSources([]);
      }
    },
    [resetSimilar],
  );

  // Conversational filter sentence. Each segment is a multi-select toggle; the
  // page owns add/remove via toggleItem, so the underlying RecFilters state and
  // the server-filtered query are unchanged from the previous chip rows.
  const filterSegments: FilterSegment[] = useMemo(
    () => [
      {
        key: "type",
        options: TYPE_OPTIONS.map((o) => ({
          value: o.value,
          word: o.word,
          ariaLabel: o.ariaLabel,
        })),
        activeValue: "",
        mode: "toggle",
        multiple: true,
        activeValues: filters.mediaTypes,
        onSelect: (value) => {
          setFilters((previous) => ({
            ...previous,
            mediaTypes: toggleItem(previous.mediaTypes, value as MediaTypeValue),
          }));
        },
      },
      {
        key: "genre",
        label: "from",
        options: availableGenres.map((genre) => ({
          value: genre,
          word: genre.toLowerCase(),
          ariaLabel: `Toggle ${genre}`,
        })),
        activeValue: "",
        mode: "toggle",
        multiple: true,
        activeValues: filters.genres,
        onSelect: (value) => {
          setFilters((previous) => ({ ...previous, genres: toggleItem(previous.genres, value) }));
        },
      },
      {
        key: "decade",
        label: "made in the",
        options: ERA_OPTIONS.map((o) => ({ value: o.value, word: o.word, ariaLabel: o.ariaLabel })),
        activeValue: "",
        mode: "toggle",
        multiple: true,
        activeValues: filters.decades,
        onSelect: (value) => {
          setFilters((previous) => ({ ...previous, decades: toggleItem(previous.decades, value) }));
        },
      },
    ],
    [filters.mediaTypes, filters.genres, filters.decades, availableGenres],
  );

  // Personalized / fallback section descriptors. Drives both the section bodies
  // and the numbered chrome + asides, so the running order is declared once.
  const sections: SectionDescriptor[] = useMemo(() => {
    if (meta === undefined) {
      // Meta still loading: a single loading section, no fallback flash.
      return [
        {
          key: "content",
          title: "Based on your taste",
          description: "Genres and directors you rate highly.",
          data: undefined,
          isLoading: true,
          onRefresh: () => {
            void contentRefresh.refresh();
          },
          isRefreshing: contentRefresh.isRefreshing,
        },
      ];
    }

    if (isPersonalized) {
      return [
        {
          key: "content",
          title: "Based on your taste",
          description: "Genres and directors you rate highly.",
          data: content.data,
          isLoading: content.isLoading,
          onRefresh: () => {
            void contentRefresh.refresh();
          },
          isRefreshing: contentRefresh.isRefreshing,
        },
        {
          key: "collaborative",
          title: "Similar tastes in the group",
          description: "Friends with ratings like yours loved these.",
          data: collab.data,
          isLoading: collab.isLoading,
          onRefresh: () => {
            void collabRefresh.refresh();
          },
          isRefreshing: collabRefresh.isRefreshing,
          aside: <FriendStack friends={collectFriends(collab.data?.items)} />,
        },
        {
          key: "tmdb",
          title: "Because you loved your top picks",
          description: "TMDB calls these its closest neighbors.",
          data: tmdb.data,
          isLoading: tmdb.isLoading,
          onRefresh: () => {
            void tmdbRefresh.refresh();
          },
          isRefreshing: tmdbRefresh.isRefreshing,
          aside: <SourceTag source="TMDB" />,
        },
        {
          key: "group",
          title: "Group pick",
          description: "What everyone in the group would enjoy.",
          data: group.data,
          isLoading: group.isLoading,
          onRefresh: () => {
            void groupRefresh.refresh();
          },
          isRefreshing: groupRefresh.isRefreshing,
        },
      ];
    }

    // Not personalized: the trending-in-group fallback drives the one section.
    return [
      {
        key: "content",
        title: "Trending in the group",
        description: "Popular picks from your group's recent sessions.",
        data: content.data,
        isLoading: content.isLoading,
        onRefresh: () => {
          void contentRefresh.refresh();
        },
        isRefreshing: contentRefresh.isRefreshing,
      },
    ];
  }, [
    meta,
    isPersonalized,
    content.data,
    content.isLoading,
    collab.data,
    collab.isLoading,
    tmdb.data,
    tmdb.isLoading,
    group.data,
    group.isLoading,
    contentRefresh,
    collabRefresh,
    tmdbRefresh,
    groupRefresh,
  ]);

  const eyebrow =
    user?.displayName != null || user?.username != null
      ? `Editorial · curated for ${user.displayName ?? user.username}`
      : "Editorial · curated for you";

  const collagePosters = useMemo(
    () =>
      collectPosters(
        [content.data?.items, group.data?.items, collab.data?.items, tmdb.data?.items],
        COLLAGE_POSTER_COUNT,
      ),
    [content.data?.items, group.data?.items, collab.data?.items, tmdb.data?.items],
  );

  return (
    <div className="mx-auto max-w-7xl space-y-10">
      <EditorialMasthead
        eyebrow={eyebrow}
        titleLead="For"
        titleAccent="you"
        align="left"
        lede="Ranked four ways. Tuned to your ratings, the group's history, and what TMDB thinks you'd love next."
        actions={
          <>
            <DismissedItemsSheet dismissedCount={dismissedCount} />
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCwIcon className={`mr-2 size-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh all
            </Button>
          </>
        }
      />

      {!isPersonalized && meta !== undefined ? (
        <WarmingUpBanner
          ratingCount={ratingCount}
          ratingsNeeded={ratingsNeeded}
          threshold={MIN_RATINGS_FOR_PERSONALIZED}
          posters={collagePosters}
        />
      ) : null}

      {/* Tools card (Predict My Rating + Find Similar) — kit order: above filters. */}
      <RecommendationToolsCard
        selectedSources={selectedSources}
        onSourcesChange={handleSourcesChange}
        onFindSimilar={handleFindSimilar}
        isSimilarLoading={isSimilarLoading}
        hasSimilarResults={similarResults.length > 0}
      />

      {/* Similar Titles results (only when sources have been searched). */}
      {(similarResults.length > 0 || isSimilarLoading) && (
        <NumberedSection
          marker="★"
          aside={
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-8"
              onClick={handleSimilarRefresh}
              disabled={isSimilarRefreshing}
            >
              <RefreshCwIcon className={`size-4 ${isSimilarRefreshing ? "animate-spin" : ""}`} />
              <span className="sr-only">Refresh similar titles</span>
            </Button>
          }
        >
          <RecommendationSection
            title="Similar Titles"
            description="Titles similar to your selected picks"
            items={similarResults.slice(0, DISPLAY_LIMIT)}
            isLoading={isSimilarLoading}
            emptyMessage="No similar titles found. Try different source titles."
            onDismiss={handleDismiss}
          />
        </NumberedSection>
      )}

      <ConversationalFilters
        lead="Show me"
        segments={filterSegments}
        actions={
          hasActiveFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters({ mediaTypes: [], genres: [], decades: [] });
              }}
            >
              Clear filters
            </Button>
          ) : undefined
        }
      />

      {/* Sections */}
      <div className="space-y-8">
        {hasActiveFilters ? (
          <NumberedSection marker={sectionNumber(0)}>
            <RecommendationSection
              title="Filtered Results"
              description={buildFilterDescription(filters)}
              items={(filteredData?.items ?? []).slice(0, DISPLAY_LIMIT)}
              isLoading={filteredLoading}
              emptyMessage="No recommendations match your filters. Try adjusting or clearing them."
              onDismiss={handleDismiss}
            />
          </NumberedSection>
        ) : (
          sections.map((section, index) => (
            <NumberedSection key={section.key} marker={sectionNumber(index)} aside={section.aside}>
              <RecommendationSection
                title={section.title}
                description={section.description}
                items={(section.data?.items ?? []).slice(0, DISPLAY_LIMIT)}
                isLoading={section.isLoading}
                emptyMessage="No recommendations available yet."
                onDismiss={handleDismiss}
                onRefresh={section.onRefresh}
                isRefreshing={section.isRefreshing}
              />
            </NumberedSection>
          ))
        )}
      </div>
    </div>
  );
}
