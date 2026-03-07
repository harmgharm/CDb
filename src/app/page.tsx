"use client";

import {
  ClapperboardIcon,
  ClockIcon,
  FilmIcon,
  LogInIcon,
  MonitorPlayIcon,
  StarIcon,
  TvIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiResponse } from "@/lib/api/response";
import type { MediaType } from "@/lib/db/types";

interface PublicStats {
  readonly mediaWatched: Record<string, number>;
  readonly totalSessions: number;
  readonly totalRatings: number;
  readonly memberCount: number;
  readonly hoursWatched: number;
  readonly avgRating: number | null;
  readonly mostWatchedGenre: string | null;
  readonly recentMedia: readonly {
    readonly title: string;
    readonly type: MediaType;
    readonly posterUrl: string | null;
    readonly dateWatched: string;
  }[];
  readonly topMedia: readonly {
    readonly id: string;
    readonly title: string;
    readonly type: MediaType;
    readonly posterUrl: string | null;
    readonly avgScore: number;
    readonly ratingCount: number;
  }[];
}

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 20 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.3 + index * 0.1, duration: 0.4, ease: "easeOut" as const },
  }),
};

function StatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Card key={index}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-20" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-12" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MediaCardSkeleton() {
  return (
    <div className="flex gap-3 rounded-lg border p-3">
      <Skeleton className="h-20 w-14 shrink-0 rounded" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

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
          <div className="text-2xl font-bold">{String(value)}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function LandingPage() {
  const router = useRouter();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuthAndFetchStats() {
      // Check if user is logged in (try /me, then refresh if needed)
      try {
        let meResponse = await fetch("/api/auth/me");
        if (meResponse.status === 401) {
          const refreshResponse = await fetch("/api/auth/refresh", { method: "POST" });
          if (refreshResponse.ok) {
            meResponse = await fetch("/api/auth/me");
          }
        }
        const meJson = (await meResponse.json()) as ApiResponse<unknown>;
        if (meJson.error === null) {
          router.replace("/home");
          return;
        }
      } catch {
        // Not logged in — continue showing landing page
      }

      // Fetch public stats
      try {
        const response = await fetch("/api/stats/public");
        const json = (await response.json()) as ApiResponse<PublicStats>;
        if (json.error === null) {
          setStats(json.data);
        }
      } catch {
        // Silently fail — page still works without stats
      } finally {
        setIsLoading(false);
      }
    }
    void checkAuthAndFetchStats();
  }, [router]);

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" as const }}
        className="text-center"
      >
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">CinemaDatabase</h1>
        <p className="text-muted-foreground mt-4 text-lg sm:text-xl">
          Track movies, anime, and TV shows with friends.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/login">
              <LogInIcon className="mr-2 size-4" />
              Log In
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/signup">
              <UserPlusIcon className="mr-2 size-4" />
              Sign Up
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="mt-16 space-y-10">
        <StatsOverviewSection stats={stats} isLoading={isLoading} />

        {/* Top Rated */}
        <TopRatedSection stats={stats} isLoading={isLoading} />

        {/* Recently Watched */}
        <RecentSection stats={stats} isLoading={isLoading} />
      </div>
    </main>
  );
}

interface SectionProps {
  readonly stats: PublicStats | null;
  readonly isLoading: boolean;
}

function StatsOverviewSection({ stats, isLoading }: SectionProps) {
  if (isLoading) {
    return <StatsSkeleton />;
  }

  if (stats === null) {
    return null;
  }

  const movies = stats.mediaWatched.movie ?? 0;
  const tv = stats.mediaWatched.tv ?? 0;
  const anime = stats.mediaWatched.anime ?? 0;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Movies"
          value={movies}
          icon={<FilmIcon className="text-muted-foreground size-4" />}
          index={0}
        />
        <StatCard
          title="TV Shows"
          value={tv}
          icon={<TvIcon className="text-muted-foreground size-4" />}
          index={1}
        />
        <StatCard
          title="Anime"
          value={anime}
          icon={<MonitorPlayIcon className="text-muted-foreground size-4" />}
          index={2}
        />
        <StatCard
          title="Members"
          value={stats.memberCount}
          icon={<UsersIcon className="text-muted-foreground size-4" />}
          index={3}
        />
      </div>

      <div className="grid gap-4 text-center sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <ClapperboardIcon className="text-muted-foreground size-5" />
              <span className="text-3xl font-bold">{String(stats.totalSessions)}</span>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">Watch Sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <StarIcon className="size-5 fill-amber-500 text-amber-500" />
              <span className="text-3xl font-bold">{String(stats.totalRatings)}</span>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">Ratings Given</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <ClockIcon className="text-muted-foreground size-5" />
              <span className="text-3xl font-bold">{String(stats.hoursWatched)}</span>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">Hours Watched</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-2">
              <StarIcon className="size-5 fill-amber-500 text-amber-500" />
              <span className="text-3xl font-bold">
                {stats.avgRating === null ? "—" : stats.avgRating.toFixed(1)}
              </span>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">Avg Rating</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function TopRatedSection({ stats, isLoading }: SectionProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }, (_, index) => (
            <MediaCardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (stats === null || stats.topMedia.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Top Rated</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.topMedia.map((media, index) => (
          <motion.div
            key={media.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + index * 0.1, duration: 0.3 }}
          >
            <Card className="h-full">
              <CardContent className="flex gap-3 p-3">
                <MediaPoster
                  posterUrl={media.posterUrl}
                  title={media.title}
                  className="h-20 w-14 shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="truncate text-sm font-medium">{media.title}</h3>
                  <MediaTypeBadge type={media.type} />
                  <div className="flex items-center gap-1">
                    <StarIcon className="size-3 fill-amber-500 text-amber-500" />
                    <span className="text-sm font-medium">{String(media.avgScore)}/10</span>
                    <span className="text-muted-foreground text-xs">
                      ({String(media.ratingCount)})
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function RecentSection({ stats, isLoading }: SectionProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <MediaCardSkeleton key={index} />
          ))}
        </div>
      </div>
    );
  }

  if (stats === null || stats.recentMedia.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Recently Watched</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.recentMedia.map((media, index) => (
          <motion.div
            key={`${media.title}-${media.dateWatched}-${String(index)}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 + index * 0.05, duration: 0.3 }}
          >
            <Card className="h-full">
              <CardContent className="flex gap-3 p-3">
                <MediaPoster
                  posterUrl={media.posterUrl}
                  title={media.title}
                  className="h-20 w-14 shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="truncate text-sm font-medium">{media.title}</h3>
                  <MediaTypeBadge type={media.type} />
                  <Badge variant="outline" className="text-xs">
                    {formatDate(media.dateWatched)}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
