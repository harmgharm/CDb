"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useGroupDetailedStats } from "@/hooks/use-stats";

import { GroupLeaders } from "./group-leaders";
import { ViewingHabits } from "./viewing-habits";

/**
 * Two-column dashboard row: group leaders (left) and viewing habits (right).
 * Both read from /api/stats/detailed, which also feeds Deep Cuts lower on the
 * page, so SWR dedupes to a single request.
 */

function TwoColSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Skeleton className="h-64 rounded-lg" />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

export function LeadersAndHabits() {
  const { data: stats, isLoading } = useGroupDetailedStats();

  if (isLoading) return <TwoColSkeleton />;
  if (stats === undefined) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <GroupLeaders leaders={stats.pickerLeaderboard} />
      <div className="bg-card flex flex-col gap-3.5 rounded-lg border px-5 pt-[18px] pb-5">
        <h3 className="text-sm font-semibold">Viewing habits</h3>
        <ViewingHabits habits={stats.watchingHabits} />
      </div>
    </div>
  );
}
