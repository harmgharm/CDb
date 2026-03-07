"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { RecommendationReason } from "@/types/recommendation-responses";

const TAG_STYLES: Record<string, string> = {
  "Top genre": "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
  "Top director": "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20",
  "Similar taste": "bg-green-500/10 text-green-500 hover:bg-green-500/20",
  "TMDB suggests": "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20",
  "MAL suggests": "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20",
  "Group genre": "bg-pink-500/10 text-pink-500 hover:bg-pink-500/20",
  "Watchlist popular": "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20",
  "Trending in group": "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20",
  "Trending pick": "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20",
};

const DEFAULT_STYLE = "bg-muted text-muted-foreground hover:bg-muted/80";

interface RecommendationReasonTagsProps {
  readonly reasons: RecommendationReason[];
  readonly maxTags?: number;
}

export function RecommendationReasonTags({ reasons, maxTags = 2 }: RecommendationReasonTagsProps) {
  const displayReasons = reasons.slice(0, maxTags);

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1">
        {displayReasons.map((reason, index) => (
          <Tooltip key={`${reason.tag}-${String(index)}`}>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className={`cursor-default text-[10px] font-normal ${TAG_STYLES[reason.tag] ?? DEFAULT_STYLE}`}
              >
                {reason.tag}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-60">
              <p className="text-xs">{reason.detail}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {reasons.length > maxTags && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="cursor-default text-[10px] font-normal">
                +{String(reasons.length - maxTags)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-60">
              <div className="space-y-1">
                {reasons.slice(maxTags).map((reason, index) => (
                  <p key={`${reason.tag}-extra-${String(index)}`} className="text-xs">
                    <span className="font-medium">{reason.tag}:</span> {reason.detail}
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
