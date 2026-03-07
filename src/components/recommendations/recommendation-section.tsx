"use client";

import { FilmIcon } from "lucide-react";

import { RecommendationCard } from "@/components/recommendations/recommendation-card";
import { RecommendationSkeleton } from "@/components/recommendations/recommendation-skeleton";
import type { RecommendationItem } from "@/types/recommendation-responses";

interface RecommendationSectionProps {
  readonly title: string;
  readonly description: string;
  readonly items: RecommendationItem[];
  readonly isLoading: boolean;
  readonly emptyMessage?: string;
  readonly onWatchlistChange?: () => void;
}

export function RecommendationSection({
  title,
  description,
  items,
  isLoading,
  emptyMessage = "No recommendations available yet.",
  onWatchlistChange,
}: RecommendationSectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>

      {isLoading && <RecommendationSkeleton />}

      {!isLoading && items.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <FilmIcon className="text-muted-foreground mb-3 size-10" />
          <p className="text-muted-foreground text-sm">{emptyMessage}</p>
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((item, index) => (
            <RecommendationCard
              key={item.mediaId ?? `${String(item.tmdbId)}-${String(item.malId)}`}
              item={item}
              index={index}
              onWatchlistChange={onWatchlistChange}
            />
          ))}
        </div>
      )}
    </section>
  );
}
