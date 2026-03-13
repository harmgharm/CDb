"use client";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Badge } from "@/components/ui/badge";
import type { MediaSearchResult } from "@/types/media";

interface PredictionSearchItemProps {
  readonly item: MediaSearchResult;
  readonly onClick: () => void;
}

export function PredictionSearchItem({ item, onClick }: PredictionSearchItemProps) {
  return (
    <button
      type="button"
      className="hover:bg-accent flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors"
      onClick={onClick}
    >
      <div className="size-[40px] shrink-0 overflow-hidden rounded sm:h-[60px] sm:w-[40px]">
        <MediaPoster posterUrl={item.posterUrl} title={item.title} className="size-full" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.title}</p>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
          {item.releaseYear !== null && <span>{String(item.releaseYear)}</span>}
          <MediaTypeBadge type={item.type} />
        </div>
      </div>
      {item.existingMediaId !== undefined && (
        <Badge variant="outline" className="shrink-0 text-[10px]">
          In library
        </Badge>
      )}
    </button>
  );
}
