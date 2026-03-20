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

export function RecommendationToolsCard({
  selectedSources,
  onSourcesChange,
  onFindSimilar,
  isSimilarLoading,
  hasSimilarResults,
}: RecommendationToolsCardProps) {
  return (
    <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 to-transparent">
      <Tabs defaultValue="predict">
        <CardHeader>
          <TabsList className="w-fit">
            <TabsTrigger value="predict">
              <SparklesIcon className="mr-1.5 size-4" />
              Predict My Rating
            </TabsTrigger>
            <TabsTrigger value="similar">
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
