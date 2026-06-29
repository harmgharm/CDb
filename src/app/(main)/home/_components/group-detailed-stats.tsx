"use client";

import {
  BarChart3Icon,
  BookmarkIcon,
  FilmIcon,
  StarIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";
import { useState } from "react";

import { CategoryStatList } from "@/components/stats/category-stat-list";
import { PickerLeaderboard } from "@/components/stats/picker-leaderboard";
import { DivisiveMediaList, RankedMediaList } from "@/components/stats/ranked-media-list";
import { StatPair } from "@/components/stats/stat-pair";
import { Skeleton } from "@/components/ui/skeleton";
import { useGroupDetailedStats } from "@/hooks/use-stats";
import type { GroupDetailedStats as GroupDetailedStatsData } from "@/types/detailed-stats";

/**
 * Deep Cuts: the detailed group stats as a left-rail tab switcher (kit's
 * `cdb-deep`). Six categories — Ratings, Genres, Directors, Cast, Years,
 * Picker leaderboard — one visible at a time. The section bodies reuse the
 * existing stat list components unchanged; only the chrome changed from a stack
 * of accordions to the tab rail. Tab counts are real, derived from the data.
 */

type SectionId = "ratings" | "genres" | "directors" | "cast" | "years" | "pickers";

interface SectionTab {
  readonly id: SectionId;
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly count: string;
}

function formatYearRange(range: GroupDetailedStatsData["totals"]["yearRange"]): string {
  if (range === null) return "no years";
  const [first, last] = range;
  if (first === last) return String(first);
  return `${String(first)}–${String(last)}`;
}

function buildTabs(stats: GroupDetailedStatsData): SectionTab[] {
  const { totals } = stats;
  const yearsLabel = formatYearRange(totals.yearRange);
  return [
    {
      id: "ratings",
      label: "Ratings",
      icon: <StarIcon className="size-[13px]" />,
      count: `${String(totals.ratedTitles)} ranked`,
    },
    {
      id: "genres",
      label: "Genres",
      icon: <BookmarkIcon className="size-[13px]" />,
      count: `${String(totals.genres)} tracked`,
    },
    {
      id: "directors",
      label: "Directors",
      icon: <FilmIcon className="size-[13px]" />,
      count: `${String(totals.directors)} listed`,
    },
    {
      id: "cast",
      label: "Cast",
      icon: <UsersIcon className="size-[13px]" />,
      count: `${String(totals.cast)} names`,
    },
    {
      id: "years",
      label: "Years",
      icon: <BarChart3Icon className="size-[13px]" />,
      count: yearsLabel,
    },
    {
      id: "pickers",
      label: "Picker leaderboard",
      icon: <TrophyIcon className="size-[13px]" />,
      count: `${String(totals.pickers)} players`,
    },
  ];
}

function SectionContent({ id, stats }: Readonly<{ id: SectionId; stats: GroupDetailedStatsData }>) {
  switch (id) {
    case "ratings": {
      return (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <RankedMediaList items={stats.ratings.highestRated} label="Highest Rated" />
          <RankedMediaList items={stats.ratings.lowestRated} label="Lowest Rated" />
          <DivisiveMediaList items={stats.ratings.mostDivisive} label="Most Divisive" />
        </div>
      );
    }
    case "genres": {
      return (
        <div className="space-y-6">
          <StatPair>
            <CategoryStatList items={stats.genres.mostWatched} label="Most Watched" />
            <CategoryStatList items={stats.genres.leastWatched} label="Least Watched" />
          </StatPair>
          <StatPair>
            <CategoryStatList items={stats.genres.highestRated} label="Highest Rated" showScore />
            <CategoryStatList items={stats.genres.lowestRated} label="Lowest Rated" showScore />
          </StatPair>
        </div>
      );
    }
    case "directors": {
      return (
        <div className="space-y-6">
          <CategoryStatList items={stats.directors.mostWatched} label="Most Watched" />
          <StatPair>
            <CategoryStatList
              items={stats.directors.highestRated}
              label="Highest Rated"
              showScore
            />
            <CategoryStatList items={stats.directors.lowestRated} label="Lowest Rated" showScore />
          </StatPair>
        </div>
      );
    }
    case "cast": {
      return (
        <div className="space-y-6">
          <CategoryStatList items={stats.cast.mostWatched} label="Most Watched" />
          <StatPair>
            <CategoryStatList items={stats.cast.highestRated} label="Highest Rated" showScore />
            <CategoryStatList items={stats.cast.lowestRated} label="Lowest Rated" showScore />
          </StatPair>
        </div>
      );
    }
    case "years": {
      return (
        <div className="space-y-6">
          <StatPair>
            <CategoryStatList items={stats.years.mostWatched} label="Most Watched" showScore />
            <CategoryStatList items={stats.years.leastWatched} label="Least Watched" showScore />
          </StatPair>
          <StatPair>
            <CategoryStatList items={stats.years.highestRated} label="Highest Rated" showScore />
            <CategoryStatList items={stats.years.lowestRated} label="Lowest Rated" showScore />
          </StatPair>
        </div>
      );
    }
    case "pickers": {
      return <PickerLeaderboard pickers={stats.pickerLeaderboard} />;
    }
  }
}

function DetailedStatsSkeleton() {
  return <Skeleton className="h-80 rounded-lg" />;
}

export function GroupDetailedStats() {
  const { data: stats, isLoading } = useGroupDetailedStats();
  const [active, setActive] = useState<SectionId>("ratings");

  if (isLoading) return <DetailedStatsSkeleton />;
  if (stats === undefined) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Not enough watch history yet. Log some sessions to see detailed stats!
      </p>
    );
  }

  const tabs = buildTabs(stats);

  return (
    <section className="flex flex-col">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-xs font-semibold tracking-[0.12em] text-[var(--fg-dim)] uppercase">
          Deep cuts
        </span>
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>
      <div className="bg-card grid min-h-80 grid-cols-1 overflow-hidden rounded-lg border lg:grid-cols-[220px_1fr]">
        {/* Tab rail */}
        <div className="flex gap-px overflow-x-auto border-b bg-[var(--bg-elev-1)] p-2 lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0 lg:px-2 lg:py-3.5">
          {tabs.map((tab) => {
            const isActive = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActive(tab.id);
                }}
                aria-current={isActive ? "true" : undefined}
                className={`relative grid shrink-0 grid-cols-[16px_1fr] items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-[13px] transition-colors lg:grid-cols-[16px_1fr_auto] ${
                  isActive
                    ? "text-cdb-marquee-text bg-[var(--bg-elev-3)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-[var(--bg-elev-2)]"
                }`}
              >
                {isActive && (
                  <span className="bg-cdb-marquee absolute top-2 bottom-2 -left-2 hidden w-0.5 rounded-r-sm lg:block" />
                )}
                {tab.icon}
                <span className="truncate font-medium">{tab.label}</span>
                <span className="hidden font-mono text-[10px] tracking-[0.04em] text-[var(--fg-dim)] lg:inline">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active section */}
        <div className="min-w-0 px-6 py-6 lg:px-7">
          <SectionContent id={active} stats={stats} />
        </div>
      </div>
    </section>
  );
}
