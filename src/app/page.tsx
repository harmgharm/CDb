"use client";

import {
  BarChart3Icon,
  ClapperboardIcon,
  DicesIcon,
  LogInIcon,
  SparklesIcon,
  StarIcon,
  UserPlusIcon,
} from "lucide-react";
import { animate, useMotionValue, useTransform } from "motion/react";
import * as motion from "motion/react-client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

// --- Animation Helpers ---

function CountUp({ target }: { readonly target: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(count, target, {
      duration: 1.5,
      ease: "easeOut",
    });
    const unsubscribe = rounded.on("change", (value) => {
      setDisplay(value);
    });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [count, rounded, target]);

  return <>{String(display)}</>;
}

// --- Skeleton Components ---

function HeroSkeleton() {
  return (
    <section className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-900 to-black">
      <div className="flex flex-col items-center gap-6">
        <Skeleton className="h-16 w-48" />
        <Skeleton className="h-6 w-80" />
        <Skeleton className="h-5 w-64" />
        <div className="flex gap-3">
          <Skeleton className="h-11 w-28" />
          <Skeleton className="h-11 w-28" />
        </div>
      </div>
    </section>
  );
}

function TopRatedSkeleton() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <Skeleton className="mb-6 h-7 w-52" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="w-[150px] shrink-0 sm:w-[170px]">
            <Skeleton className="aspect-[2/3] w-full rounded-lg" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <Skeleton className="mt-1 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </section>
  );
}

// --- Hero Section ---

interface HeroProps {
  readonly stats: PublicStats;
}

function HeroBackdrop({ posters }: { readonly posters: readonly string[] }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-4 overflow-hidden">
      {posters.map((url, index) => (
        <motion.div
          key={url}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 0.2, scale: 1 }}
          transition={{
            delay: index * 0.2,
            duration: 0.8,
            ease: "easeOut" as const,
          }}
          className="relative h-[70%] w-[140px] shrink-0 overflow-hidden rounded-lg sm:w-[180px] md:w-[200px]"
        >
          <Image
            src={url}
            alt=""
            fill
            className="object-cover blur-sm"
            sizes="200px"
            priority={index < 3}
          />
        </motion.div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black" />
    </div>
  );
}

function HeroSection({ stats }: HeroProps) {
  const posterUrls = stats.topMedia
    .filter((m) => m.posterUrl !== null)
    .map((m) => m.posterUrl as string);

  const movies = stats.mediaWatched.movie ?? 0;
  const tv = stats.mediaWatched.tv ?? 0;
  const anime = stats.mediaWatched.anime ?? 0;
  const totalMedia = movies + tv + anime;

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
      {posterUrls.length > 0 && <HeroBackdrop posters={posterUrls} />}

      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" as const }}
          className="text-6xl font-bold tracking-tight sm:text-7xl lg:text-8xl"
        >
          CDb
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" as const }}
          className="text-muted-foreground mt-4 text-lg sm:text-xl"
        >
          Track movies, anime, and TV shows with friends.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" as const }}
          className="text-muted-foreground mt-6 flex items-center gap-3 text-sm sm:gap-4 sm:text-base"
        >
          <span>
            <span className="font-bold text-white">
              <CountUp target={totalMedia} />
            </span>{" "}
            titles
          </span>
          <span className="text-muted-foreground/50">&middot;</span>
          <span>
            <span className="font-bold text-white">
              <CountUp target={stats.totalSessions} />
            </span>{" "}
            sessions
          </span>
          <span className="text-muted-foreground/50">&middot;</span>
          <span>
            <span className="font-bold text-white">
              <CountUp target={stats.hoursWatched} />
            </span>{" "}
            hours
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5, ease: "easeOut" as const }}
          className="mt-8 flex gap-3"
        >
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
        </motion.div>
      </div>
    </section>
  );
}

// --- Feature Grid ---

const FEATURES = [
  {
    icon: ClapperboardIcon,
    title: "Track & Rate",
    description: "Log watch sessions and score them together",
    gradient: "from-purple-500/10 to-purple-500/5",
    border: "border-purple-500/20",
    iconColor: "text-purple-400",
  },
  {
    icon: SparklesIcon,
    title: "Smart Recommendations",
    description: "AI-powered suggestions based on your group's taste",
    gradient: "from-blue-500/10 to-blue-500/5",
    border: "border-blue-500/20",
    iconColor: "text-blue-400",
  },
  {
    icon: BarChart3Icon,
    title: "Stats & Insights",
    description: "Personal and group analytics on everything you watch",
    gradient: "from-amber-500/10 to-amber-500/5",
    border: "border-amber-500/20",
    iconColor: "text-amber-400",
  },
  {
    icon: DicesIcon,
    title: "Games",
    description: "Poster reveal, year guesser, and more",
    gradient: "from-emerald-500/10 to-emerald-500/5",
    border: "border-emerald-500/20",
    iconColor: "text-emerald-400",
  },
] as const;

function FeatureGrid() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-24">
      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              delay: index * 0.1,
              duration: 0.4,
              ease: "easeOut" as const,
            }}
            className={`rounded-xl border bg-gradient-to-br p-6 ${feature.gradient} ${feature.border}`}
          >
            <feature.icon className={`size-6 ${feature.iconColor}`} />
            <h3 className="mt-3 font-semibold">{feature.title}</h3>
            <p className="text-muted-foreground mt-1 text-sm">{feature.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// --- Top Rated Poster Row ---

interface TopRatedRowProps {
  readonly stats: PublicStats;
}

function TopRatedRow({ stats }: TopRatedRowProps) {
  if (stats.topMedia.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4, ease: "easeOut" as const }}
        className="mb-6 text-xl font-semibold"
      >
        Top Rated by the Group
      </motion.h2>
      <div className="flex justify-center gap-4">
        {stats.topMedia.map((media, index) => (
          <motion.div
            key={media.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{
              delay: index * 0.1,
              duration: 0.4,
              ease: "easeOut" as const,
            }}
            className="group w-[140px] shrink-0 sm:w-[160px] md:w-[170px]"
          >
            <div className="relative aspect-[2/3] overflow-hidden rounded-lg transition-transform duration-200 group-hover:scale-[1.03]">
              <MediaPoster
                posterUrl={media.posterUrl}
                title={media.title}
                className="h-full w-full"
              />
              <div className="absolute bottom-2 left-2">
                <MediaTypeBadge type={media.type} />
              </div>
            </div>
            <h3 className="mt-2 truncate text-sm font-medium">{media.title}</h3>
            <div className="flex items-center gap-1">
              <StarIcon className="size-3 fill-amber-500 text-amber-500" />
              <span className="text-sm">{String(media.avgScore)}</span>
              <span className="text-muted-foreground text-xs">({String(media.ratingCount)})</span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// --- Recently Watched Ticker ---

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

interface TickerProps {
  readonly stats: PublicStats;
}

function RecentTicker({ stats }: TickerProps) {
  if (stats.recentMedia.length === 0) {
    return null;
  }

  // Deduplicate by title, keeping the most recent session for each
  const seen = new Set<string>();
  const unique = stats.recentMedia.filter((media) => {
    if (seen.has(media.title)) {
      return false;
    }
    seen.add(media.title);
    return true;
  });

  // Duplicate items 4x for seamless loop on wide viewports
  const items = [...unique, ...unique, ...unique, ...unique];

  return (
    <section className="border-t border-white/10 py-6">
      <div className="relative overflow-hidden">
        <div className="animate-ticker flex w-max gap-8 hover:[animation-play-state:paused]">
          {items.map((media, index) => (
            <div
              key={`${media.title}-${String(index)}`}
              className="flex shrink-0 items-center gap-3"
            >
              {media.posterUrl !== null && (
                <div className="relative h-10 w-7 shrink-0 overflow-hidden rounded">
                  <Image
                    src={media.posterUrl}
                    alt={`${media.title} poster`}
                    fill
                    className="object-cover"
                    sizes="28px"
                  />
                </div>
              )}
              <span className="text-sm font-medium">{media.title}</span>
              <MediaTypeBadge type={media.type} />
              <Badge variant="outline" className="text-muted-foreground text-xs">
                {formatDate(media.dateWatched)}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- Footer ---

function LandingFooter() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: "easeOut" as const }}
      className="border-t border-white/10 px-6 py-12"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6">
        <div className="flex gap-3">
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

        <div className="text-muted-foreground flex items-center gap-4 text-sm">
          <a
            href="https://github.com/harmgharm/CDb"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-white"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
          </a>
          <span>&copy; {String(new Date().getFullYear())} CDb</span>
        </div>
      </div>
    </motion.footer>
  );
}

// --- Main Page ---

export default function LandingPage() {
  const router = useRouter();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkAuthAndFetchStats() {
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
    <main className="min-h-screen bg-black text-white">
      {isLoading || stats === null ? <HeroSkeleton /> : <HeroSection stats={stats} />}
      <FeatureGrid />
      {isLoading ? <TopRatedSkeleton /> : stats !== null && <TopRatedRow stats={stats} />}
      {stats !== null && <RecentTicker stats={stats} />}
      <LandingFooter />
    </main>
  );
}
