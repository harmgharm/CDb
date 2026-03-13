"use client";

import {
  BarChart3Icon,
  CalendarIcon,
  ClockIcon,
  CrownIcon,
  FilmIcon,
  FlameIcon,
  MusicIcon,
  StarIcon,
} from "lucide-react";

import { CategoryStatList } from "@/components/stats/category-stat-list";
import { HeroStat } from "@/components/stats/hero-stat";
import { PickerLeaderboard } from "@/components/stats/picker-leaderboard";
import { DivisiveMediaList, RankedMediaList } from "@/components/stats/ranked-media-list";
import { StatPair } from "@/components/stats/stat-pair";
import { StatsSection } from "@/components/stats/stats-section";
import { Skeleton } from "@/components/ui/skeleton";
import { useGroupDetailedStats } from "@/hooks/use-stats";

function DetailedStatsSkeleton() {
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

function formatTime12h(time24: string): string {
  const [hoursString = "0", minutesString = "00"] = time24.split(":");
  const hours = Number(hoursString);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(displayHours)}:${minutesString} ${period}`;
}

export function GroupDetailedStats() {
  const { data: stats, isLoading } = useGroupDetailedStats();

  if (isLoading) return <DetailedStatsSkeleton />;
  if (stats === undefined) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Not enough watch history yet. Log some sessions to see detailed stats!
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroStat
          label="Watch Streak"
          value={stats.watchingHabits.longestStreak}
          suffix={
            stats.watchingHabits.currentStreak > 0
              ? `(${String(stats.watchingHabits.currentStreak)} active)`
              : "best"
          }
          icon={<FlameIcon className="size-5" />}
          color="bg-orange-500/15 text-orange-500"
          index={0}
        />
        <HeroStat
          label="Hours Watched"
          value={stats.watchingHabits.hoursWatched}
          suffix="hrs"
          icon={<ClockIcon className="size-5" />}
          color="bg-blue-500/15 text-blue-500"
          index={1}
        />
        <HeroStat
          label="Avg Start Time"
          value={
            stats.watchingHabits.avgStartTime === null
              ? "—"
              : formatTime12h(stats.watchingHabits.avgStartTime)
          }
          icon={<CalendarIcon className="size-5" />}
          color="bg-violet-500/15 text-violet-500"
          index={2}
        />
        <HeroStat
          label="Avg Rating"
          value={stats.watchingHabits.avgRating ?? 0}
          suffix="/ 10"
          icon={<StarIcon className="size-5" />}
          color="bg-amber-500/15 text-amber-500"
          index={3}
        />
      </div>

      {/* Ratings section */}
      <StatsSection title="Ratings" icon={<StarIcon className="size-4" />} defaultOpen>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <RankedMediaList items={stats.ratings.highestRated} label="Highest Rated" />
          <RankedMediaList items={stats.ratings.lowestRated} label="Lowest Rated" />
          <DivisiveMediaList items={stats.ratings.mostDivisive} label="Most Divisive" />
        </div>
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

      {/* Picker Leaderboard */}
      <StatsSection title="Picker Leaderboard" icon={<CrownIcon className="size-4" />}>
        <PickerLeaderboard pickers={stats.pickerLeaderboard} />
      </StatsSection>
    </div>
  );
}
