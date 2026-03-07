"use client";

import { SparklesIcon, StarIcon, SwordsIcon } from "lucide-react";
import * as motion from "motion/react-client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/hooks/use-stats";

const MEDIA_TYPE_LABELS: Record<string, string> = {
  movie: "Movie",
  tv: "TV Show",
  anime: "Anime",
};

function FunStatSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
        <Skeleton className="size-4" />
        <Skeleton className="h-4 w-28" />
      </CardHeader>
      <CardContent className="space-y-1">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 15 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 1 + index * 0.15, duration: 0.4, ease: "easeOut" as const },
  }),
};

export function FunStats() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div>
        <h2 className="text-lg font-semibold">Highlights</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <FunStatSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  const items = [
    {
      title: "Highest Rated",
      icon: <StarIcon className="size-4 text-amber-500" />,
      content: stats?.highestRated ? (
        <>
          <p className="text-sm font-medium">{stats.highestRated.title}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">
              {MEDIA_TYPE_LABELS[stats.highestRated.type] ?? stats.highestRated.type}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {String(stats.highestRated.avgScore)}/10
            </span>
          </div>
        </>
      ) : null,
    },
    {
      title: "Most Divisive",
      icon: <SwordsIcon className="size-4 text-orange-500" />,
      content: stats?.mostDivisive ? (
        <>
          <p className="text-sm font-medium">{stats.mostDivisive.title}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="secondary">
              {MEDIA_TYPE_LABELS[stats.mostDivisive.type] ?? stats.mostDivisive.type}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {String(stats.mostDivisive.stddev)} std dev
            </span>
          </div>
        </>
      ) : null,
    },
    {
      title: "Last Watched",
      icon: <SparklesIcon className="size-4 text-purple-500" />,
      content:
        stats?.lastSessionDate !== null && stats?.lastSessionDate !== undefined ? (
          <p className="text-sm font-medium">
            {new Date(stats.lastSessionDate).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })}
          </p>
        ) : null,
    },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold">Highlights</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <motion.div
            key={item.title}
            variants={CARD_VARIANTS}
            initial="hidden"
            animate="visible"
            custom={index}
          >
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                {item.icon}
                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {item.content ?? (
                  <p className="text-muted-foreground text-sm">Not enough data yet</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
