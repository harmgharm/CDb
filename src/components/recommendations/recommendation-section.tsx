"use client";

import { ArrowLeftIcon, ArrowRightIcon, FilmIcon } from "lucide-react";
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

interface RecommendationSectionProps {
  readonly items: RecommendationItem[];
  readonly isLoading: boolean;
  readonly emptyMessage?: string;
  readonly onDismiss?: (item: RecommendationItem) => void;
  /**
   * Render every item up front and hide the "See all" / "Show less" toggle.
   * Used by the filtered-results section, where the filter sentence is already
   * the user's "expand" gesture, so a second collapse step reads as redundant.
   */
  readonly showAll?: boolean;
}

/**
 * Body of a recommendation section: the poster row with per-card dismiss, the
 * empty/loading states, and the "See all" expand/collapse below the row. The
 * editorial head (issue number, serif title, italic lede, aside + refresh) is
 * supplied by <NumberedSection>, which wraps this — see the kit's section head.
 */
export function RecommendationSection({
  items,
  isLoading,
  emptyMessage = "No recommendations available yet.",
  onDismiss,
  showAll = false,
}: RecommendationSectionProps) {
  const [expanded, setExpanded] = useState(false);

  const canExpand = !showAll && items.length > COLLAPSED_COUNT;
  const visibleItems = showAll || expanded ? items : items.slice(0, COLLAPSED_COUNT);
  const hiddenCount = items.length - COLLAPSED_COUNT;

  return (
    <div className="space-y-4">
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
    </div>
  );
}
