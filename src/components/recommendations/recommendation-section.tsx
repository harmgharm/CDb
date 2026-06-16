"use client";

import { ArrowLeftIcon, ArrowRightIcon, FilmIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { RecommendationSkeleton } from "@/components/recommendations/recommendation-skeleton";
import { Button } from "@/components/ui/button";
import type { RecommendationItem } from "@/types/recommendation-responses";

// Collapsed sections show one row of posters; "See all" expands to the rest.
// Six fills a row at the lg breakpoint. The engine returns up to 20 per section
// today, so an expanded last row sits two short of full; bump DISPLAY_LIMIT to a
// multiple of six (e.g. 30) when the per-section engine count is raised.
const COLLAPSED_COUNT = 6;

const SECTION_ACCENT: Record<string, string> = {
  "For You": "border-l-blue-500",
  "Similar Tastes": "border-l-green-500",
  "Because You Loved...": "border-l-amber-500",
  "Group Pick": "border-l-pink-500",
  "Trending in Group": "border-l-rose-500",
  "Similar Titles": "border-l-cyan-500",
};

interface RecommendationSectionProps {
  readonly title: string;
  readonly description: string;
  readonly items: RecommendationItem[];
  readonly isLoading: boolean;
  readonly emptyMessage?: string;
  readonly onDismiss?: (item: RecommendationItem) => void;
  readonly onRefresh?: () => void;
  readonly isRefreshing?: boolean;
}

export function RecommendationSection({
  title,
  description,
  items,
  isLoading,
  emptyMessage = "No recommendations available yet.",
  onDismiss,
  onRefresh,
  isRefreshing = false,
}: RecommendationSectionProps) {
  const accentClass = SECTION_ACCENT[title] ?? "border-l-muted-foreground";
  const [expanded, setExpanded] = useState(false);

  const canExpand = items.length > COLLAPSED_COUNT;
  const visibleItems = expanded ? items : items.slice(0, COLLAPSED_COUNT);
  const hiddenCount = items.length - COLLAPSED_COUNT;

  return (
    <section className="space-y-4">
      <div className={`flex items-start justify-between border-l-4 pl-3 ${accentClass}`}>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {onRefresh !== undefined && (
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground size-8 shrink-0"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCwIcon className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="sr-only">Refresh {title}</span>
          </Button>
        )}
      </div>

      {isLoading && <RecommendationSkeleton />}

      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <FilmIcon className="text-muted-foreground mb-3 size-10" />
          <p className="text-muted-foreground text-sm">{emptyMessage}</p>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {visibleItems.map((item, index) => (
              <RecommendationCard
                key={item.mediaId ?? `${String(item.tmdbId)}-${String(item.malId)}`}
                item={item}
                index={index}
                onDismiss={onDismiss}
              />
            ))}
          </div>

          {canExpand && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setExpanded((previous) => !previous);
                }}
              >
                {expanded ? (
                  <>
                    <ArrowLeftIcon className="mr-1 size-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ArrowRightIcon className="mr-1 size-3" />
                    See all {String(hiddenCount)} more
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
