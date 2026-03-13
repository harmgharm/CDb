"use client";

import { ArrowUpDownIcon, BookmarkIcon } from "lucide-react";
import * as motion from "motion/react-client";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWatchlistPredictions } from "@/hooks/use-predictions";
import { useWatchlist } from "@/hooks/use-watchlist";
import type { WatchlistStatus } from "@/lib/db/types";
import type { PredictionSummary } from "@/types/prediction-responses";
import type { WatchlistItem, WatchlistResponse } from "@/types/watchlist-responses";

import { WatchlistCard } from "./watchlist-card";

type StatusFilter = "all" | WatchlistStatus;

interface WatchlistContentProps {
  readonly isLoading: boolean;
  readonly data: WatchlistResponse | undefined;
  readonly isOwnProfile: boolean;
  readonly onChanged: () => void;
  readonly predictions: Map<string, PredictionSummary>;
  readonly sortByPrediction: boolean;
}

function sortByPredictedScore(
  items: WatchlistItem[],
  predictions: Map<string, PredictionSummary>,
): WatchlistItem[] {
  return [...items].toSorted((a, b) => {
    const scoreA = predictions.get(a.id)?.predictedScore ?? 0;
    const scoreB = predictions.get(b.id)?.predictedScore ?? 0;
    return scoreB - scoreA;
  });
}

function WatchlistContent({
  isLoading,
  data,
  isOwnProfile,
  onChanged,
  predictions,
  sortByPrediction,
}: WatchlistContentProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={String(index)} className="h-28" />
        ))}
      </div>
    );
  }

  if (data === undefined || data.items.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        {isOwnProfile
          ? "Your watchlist is empty. Add titles from the database or import dialog!"
          : "No titles in watchlist yet."}
      </p>
    );
  }

  const items = sortByPrediction ? sortByPredictedScore(data.items, predictions) : data.items;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((entry, index) => (
        <WatchlistCard
          key={entry.id}
          entry={entry}
          index={index}
          isOwnProfile={isOwnProfile}
          onChanged={onChanged}
          prediction={predictions.get(entry.id)}
        />
      ))}
    </div>
  );
}

interface WatchlistSectionProps {
  readonly userId: string;
  readonly isOwnProfile: boolean;
}

export function WatchlistSection({ userId, isOwnProfile }: WatchlistSectionProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortByPrediction, setSortByPrediction] = useState(false);

  const { data, isLoading, mutate } = useWatchlist({
    userId,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const { predictions } = useWatchlistPredictions(data?.items, isOwnProfile);

  const hasPredictions = useMemo(() => predictions.size > 0, [predictions]);

  function handleChanged() {
    void mutate();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.3, ease: "easeOut" as const }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <BookmarkIcon className="size-5" />
                Watchlist
              </CardTitle>
              {data !== undefined && <Badge variant="secondary">{String(data.total)}</Badge>}
            </div>
            {isOwnProfile && hasPredictions && (
              <Button
                variant={sortByPrediction ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setSortByPrediction((previous) => !previous);
                }}
              >
                <ArrowUpDownIcon className="mr-1.5 size-3.5" />
                {sortByPrediction ? "Sorted by prediction" : "Sort by prediction"}
              </Button>
            )}
          </div>
          <Tabs
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as StatusFilter);
            }}
            className="mt-2"
          >
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="planning">Planning</TabsTrigger>
              <TabsTrigger value="watching">Watching</TabsTrigger>
              <TabsTrigger value="scrapped">Scrapped</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          <WatchlistContent
            isLoading={isLoading}
            data={data}
            isOwnProfile={isOwnProfile}
            onChanged={handleChanged}
            predictions={predictions}
            sortByPrediction={sortByPrediction}
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}
