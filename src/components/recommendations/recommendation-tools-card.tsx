"use client";

import { LayersIcon, SparklesIcon } from "lucide-react";

import { FindSimilarContent } from "@/components/find-similar/find-similar-content";
import { PredictionContent } from "@/components/predictions/prediction-section";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SimilarSourceInput } from "@/hooks/use-find-similar";
import type { MediaSearchResult } from "@/types/media";

interface RecommendationToolsCardProps {
  readonly selectedSources: MediaSearchResult[];
  readonly onSourcesChange: (sources: MediaSearchResult[]) => void;
  readonly onFindSimilar: (sources: SimilarSourceInput[]) => void;
  readonly isSimilarLoading: boolean;
  readonly hasSimilarResults: boolean;
}

const TAB_DESCRIPTIONS: Record<string, string> = {
  predict: "Search for any title to see your predicted rating based on your taste profile",
  similar: "Select up to 5 titles and discover similar movies, shows, and anime",
};

// Kit `.cdb-rt-tab`: the active tab reads in marquee gold over a quiet
// `--bg-elev-3` chip, with no border ring. The shadcn TabsTrigger default
// tints the active text white and draws a bordered, shadowed chip (the "strong
// ring"), so we override the active text to gold and drop the border + shadow
// here (className only — the shadcn primitive stays untouched).
const TOOLS_TAB_CLASS = [
  "data-[state=active]:text-cdb-marquee-text dark:data-[state=active]:text-cdb-marquee-text",
  "data-[state=active]:border-transparent dark:data-[state=active]:border-transparent",
  "data-[state=active]:shadow-none",
].join(" ");

export function RecommendationToolsCard({
  selectedSources,
  onSourcesChange,
  onFindSimilar,
  isSimilarLoading,
  hasSimilarResults,
}: RecommendationToolsCardProps) {
  return (
    <Card
      className={[
        // Kit `.cdb-rt-card`: a marquee/amber-tinted card — border mixed with
        // the marquee, and a soft radial amber wash off the top-left over the
        // base `bg-card` (--bg-elev-1). The wash is a `before` overlay so the
        // card keeps its solid token background (and its light-mode override).
        "relative overflow-hidden border-[color-mix(in_oklch,var(--cdb-marquee)_22%,var(--border))]",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
        "before:bg-[radial-gradient(120%_140%_at_0%_0%,color-mix(in_oklch,var(--cdb-marquee)_7%,transparent)_0%,transparent_55%)]",
      ].join(" ")}
    >
      <Tabs defaultValue="predict" className="relative">
        <CardHeader>
          <TabsList className="w-fit">
            <TabsTrigger value="predict" className={TOOLS_TAB_CLASS}>
              <SparklesIcon className="mr-1.5 size-4" />
              Predict My Rating
            </TabsTrigger>
            <TabsTrigger value="similar" className={TOOLS_TAB_CLASS}>
              <LayersIcon className="mr-1.5 size-4" />
              Find Similar
            </TabsTrigger>
          </TabsList>
          <TabsContent value="predict">
            <CardDescription>{TAB_DESCRIPTIONS.predict}</CardDescription>
          </TabsContent>
          <TabsContent value="similar">
            <CardDescription>{TAB_DESCRIPTIONS.similar}</CardDescription>
          </TabsContent>
        </CardHeader>
        <CardContent>
          <TabsContent value="predict">
            <PredictionContent />
          </TabsContent>
          <TabsContent value="similar">
            <FindSimilarContent
              selectedSources={selectedSources}
              onSourcesChange={onSourcesChange}
              onFindSimilar={onFindSimilar}
              isLoading={isSimilarLoading}
              hasResults={hasSimilarResults}
            />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
