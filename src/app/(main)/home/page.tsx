"use client";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { GroupDetailedStats } from "@/components/dashboard/group-detailed-stats";
import { GroupStats } from "@/components/dashboard/group-stats";
import { StatsOverview } from "@/components/dashboard/stats-overview";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Your group&apos;s watching activity at a glance.
        </p>
      </div>

      <StatsOverview />
      <GroupStats />
      <GroupDetailedStats />
      <ActivityFeed />
    </div>
  );
}
