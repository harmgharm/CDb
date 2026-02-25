"use client";

import { ClapperboardIcon, FilmIcon, MonitorPlayIcon, StarIcon, TvIcon } from "lucide-react";
import * as motion from "motion/react-client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/hooks/use-stats";

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: index * 0.1, duration: 0.4, ease: "easeOut" as const },
  }),
};

interface StatCardProps {
  readonly title: string;
  readonly value: number;
  readonly icon: React.ReactNode;
  readonly index: number;
}

function StatCard({ title, value, icon, index }: StatCardProps) {
  return (
    <motion.div variants={CARD_VARIANTS} initial="hidden" animate="visible" custom={index}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-4" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
      </CardContent>
    </Card>
  );
}

export function StatsOverview() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <StatCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  const movies = stats?.mediaWatched.movie ?? 0;
  const tv = stats?.mediaWatched.tv ?? 0;
  const anime = stats?.mediaWatched.anime ?? 0;

  const cards = [
    {
      title: "Movies",
      value: movies,
      icon: <FilmIcon className="text-muted-foreground size-4" />,
    },
    {
      title: "TV Shows",
      value: tv,
      icon: <TvIcon className="text-muted-foreground size-4" />,
    },
    {
      title: "Anime",
      value: anime,
      icon: <MonitorPlayIcon className="text-muted-foreground size-4" />,
    },
    {
      title: "Sessions",
      value: stats?.totalSessions ?? 0,
      icon: <ClapperboardIcon className="text-muted-foreground size-4" />,
    },
    {
      title: "Ratings",
      value: stats?.totalRatings ?? 0,
      icon: <StarIcon className="text-muted-foreground size-4" />,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((card, index) => (
        <StatCard
          key={card.title}
          title={card.title}
          value={card.value}
          icon={card.icon}
          index={index}
        />
      ))}
    </div>
  );
}
