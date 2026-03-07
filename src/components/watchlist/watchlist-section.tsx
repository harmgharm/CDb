"use client";

import { BookmarkIcon } from "lucide-react";
import * as motion from "motion/react-client";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWatchlist } from "@/hooks/use-watchlist";
import type { WatchlistStatus } from "@/lib/db/types";
import type { WatchlistResponse } from "@/types/watchlist-responses";

import { WatchlistCard } from "./watchlist-card";

type StatusFilter = "all" | WatchlistStatus;

interface WatchlistContentProps {
  readonly isLoading: boolean;
  readonly data: WatchlistResponse | undefined;
  readonly isOwnProfile: boolean;
  readonly onChanged: () => void;
}

function WatchlistContent({ isLoading, data, isOwnProfile, onChanged }: WatchlistContentProps) {
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

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {data.items.map((entry, index) => (
        <WatchlistCard
          key={entry.id}
          entry={entry}
          index={index}
          isOwnProfile={isOwnProfile}
          onChanged={onChanged}
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

  const { data, isLoading, mutate } = useWatchlist({
    userId,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

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
          />
        </CardContent>
      </Card>
    </motion.div>
  );
}
