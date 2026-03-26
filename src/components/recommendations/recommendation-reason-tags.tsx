"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { RecommendationReason } from "@/types/recommendation-responses";

const TAG_STYLES: Record<string, string> = {
  "Top genre": "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
  "Top director": "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20",
  "Featured cast": "bg-violet-500/10 text-violet-500 hover:bg-violet-500/20",
  "Similar taste": "bg-green-500/10 text-green-500 hover:bg-green-500/20",
  "Shared taste": "bg-green-500/10 text-green-500 hover:bg-green-500/20",
  "TMDB suggests": "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20",
  "MAL suggests": "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20",
  "Group genre": "bg-pink-500/10 text-pink-500 hover:bg-pink-500/20",
  "Watchlist popular": "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20",
  "Trending in group": "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20",
  "Trending pick": "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20",
  "Similar to": "bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20",
};

const DEFAULT_STYLE = "bg-muted text-muted-foreground hover:bg-muted/80";

interface RecommendationReasonTagsProps {
  readonly reasons: RecommendationReason[];
  readonly maxTags?: number;
}

export function RecommendationReasonTags({ reasons, maxTags = 2 }: RecommendationReasonTagsProps) {
  // Deduplicate by tag name — show each category once, collect all details
  const tagMap = new Map<string, string[]>();
  for (const reason of reasons) {
    const details = tagMap.get(reason.tag) ?? [];
    if (!details.includes(reason.detail)) {
      details.push(reason.detail);
    }
    tagMap.set(reason.tag, details);
  }

  const tags = [...tagMap.entries()];
  const displayTags = tags.slice(0, maxTags);

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1">
        {displayTags.map(([tag, details]) => (
          <Tooltip key={tag}>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className={`cursor-default text-[10px] font-normal ${TAG_STYLES[tag] ?? DEFAULT_STYLE}`}
              >
                {tag}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-60">
              <div className="space-y-1">
                {details.map((detail) => (
                  <p key={detail} className="text-xs">
                    {detail}
                  </p>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
        {tags.length > maxTags && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="cursor-default text-[10px] font-normal">
                +{String(tags.length - maxTags)}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-60">
              <div className="space-y-1">
                {tags.slice(maxTags).map(([tag, details]) => (
                  <div key={tag}>
                    {details.map((detail) => (
                      <p key={detail} className="text-xs">
                        <span className="font-medium">{tag}:</span> {detail}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
