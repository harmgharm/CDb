"use client";

import { XIcon } from "lucide-react";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import type { MediaSearchResult } from "@/types/media";

interface SelectedSourceChipProps {
  readonly source: MediaSearchResult;
  readonly onRemove: () => void;
}

export function SelectedSourceChip({ source, onRemove }: SelectedSourceChipProps) {
  return (
    <div className="bg-muted flex items-center gap-2 rounded-lg py-1 pr-1 pl-1">
      <div className="h-[36px] w-[24px] shrink-0 overflow-hidden rounded-sm">
        <MediaPoster posterUrl={source.posterUrl} title={source.title} className="size-full" />
      </div>
      <span className="max-w-[120px] truncate text-xs font-medium">{source.title}</span>
      <MediaTypeBadge type={source.type} />
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-foreground ml-0.5 shrink-0 rounded-full p-0.5 transition-colors"
      >
        <XIcon className="size-3" />
        <span className="sr-only">Remove {source.title}</span>
      </button>
    </div>
  );
}
