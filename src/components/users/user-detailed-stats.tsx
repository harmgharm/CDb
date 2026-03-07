"use client";

import {
  BarChart3Icon,
  ClockIcon,
  CrownIcon,
  FilmIcon,
  MusicIcon,
  StarIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";

import { CategoryStatList } from "@/components/stats/category-stat-list";
import { HeroStat } from "@/components/stats/hero-stat";
import { RankedMediaList } from "@/components/stats/ranked-media-list";
import { StatPair } from "@/components/stats/stat-pair";
import { StatsSection } from "@/components/stats/stats-section";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserDetailedStats } from "@/hooks/use-users";

interface UserDetailedStatsProps {
  readonly userId: string;
}

function UserDetailedStatsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-20 rounded-lg" />
        ))}
      </div>
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-12 rounded-lg" />
      ))}
    </div>
  );
}

export function UserDetailedStats({ userId }: UserDetailedStatsProps) {
  const { data: stats, isLoading } = useUserDetailedStats(userId);

  if (isLoading) return <UserDetailedStatsSkeleton />;
  if (stats === undefined) return null;

  return (
    <div className="space-y-4">
      {/* Hero stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroStat
          label="Hours Watched"
          value={stats.watchingHabits.hoursWatched}
          suffix="hrs"
          icon={<ClockIcon className="size-5" />}
          color="bg-blue-500/15 text-blue-500"
          index={0}
        />
        <HeroStat
          label="Attendance Rate"
          value={stats.watchingHabits.attendanceRate}
          suffix="%"
          icon={<UsersIcon className="size-5" />}
          color="bg-emerald-500/15 text-emerald-500"
          index={1}
        />
        <HeroStat
          label="Pick Rating"
          value={stats.picking.pickRating ?? 0}
          suffix="/ 10"
          icon={<CrownIcon className="size-5" />}
          color="bg-amber-500/15 text-amber-500"
          index={2}
        />
        <HeroStat
          label="Win Rate"
          value={stats.picking.winRate ?? 0}
          suffix={`% (${String(stats.picking.winCount)}W / ${String(stats.picking.totalPicks - stats.picking.winCount)}L)`}
          icon={<TrophyIcon className="size-5" />}
          color="bg-violet-500/15 text-violet-500"
          index={3}
        />
      </div>

      {/* Ratings section */}
      <StatsSection title="Ratings" icon={<StarIcon className="size-4" />} defaultOpen>
        <StatPair>
          <RankedMediaList items={stats.ratings.highestRated} label="Highest Rated" />
          <RankedMediaList items={stats.ratings.lowestRated} label="Lowest Rated" />
        </StatPair>
      </StatsSection>

      {/* Genres section */}
      <StatsSection title="Genres" icon={<MusicIcon className="size-4" />}>
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
      </StatsSection>

      {/* Directors section */}
      <StatsSection title="Directors" icon={<FilmIcon className="size-4" />}>
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
      </StatsSection>

      {/* Years section */}
      <StatsSection title="Years" icon={<BarChart3Icon className="size-4" />}>
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
      </StatsSection>
    </div>
  );
}
