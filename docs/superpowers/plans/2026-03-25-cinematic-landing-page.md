# Cinematic Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the logged-out landing page as a dark, cinematic showcase with poster backdrop
hero, feature grid, top-rated poster row, scrolling ticker, and minimal footer.

**Architecture:** Single file rewrite of `src/app/page.tsx`. No API changes — existing
`GET /api/stats/public` provides all data. No new dependencies — Motion (Framer Motion) and
lucide-react are already installed. The page stays as a `"use client"` component with the same auth
check + data fetch pattern.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Motion 12.x, Tailwind CSS 4, next/image,
lucide-react

**Spec:** `docs/superpowers/specs/2026-03-25-cinematic-landing-page-design.md`

---

## File Map

| File               | Action  | Responsibility                                                    |
| ------------------ | ------- | ----------------------------------------------------------------- |
| `src/app/page.tsx` | Rewrite | Full landing page — hero, feature grid, top rated, ticker, footer |

This is a single-file rewrite. All section components are defined as local functions within
`page.tsx`, matching the current pattern. The `PublicStats` interface stays in the file (also
matching current pattern).

---

## Task 1: Hero Section — Backdrop + Title + CTAs

Rewrite the top of the page with the cinematic hero. This task replaces the current hero and removes
the old stats grid. The data fetching and auth check logic remain identical.

**Files:**

- Modify: `src/app/page.tsx` (full rewrite begins)

- [ ] **Step 1: Write the hero skeleton and page shell**

Replace the entire content of `src/app/page.tsx` with the new page shell. This preserves the
existing auth check and data fetch logic exactly, but replaces the JSX with the new hero section.

```tsx
"use client";

import {
  BarChart3Icon,
  ClapperboardIcon,
  DicesIcon,
  GithubIcon,
  LogInIcon,
  SparklesIcon,
  StarIcon,
  UserPlusIcon,
} from "lucide-react";
import * as motion from "motion/react-client";
import { animate, useMotionValue, useTransform } from "motion/react";
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
      {/* Gradient overlay */}
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
```

Notes:

- The `CountUp` component uses `useMotionValue` + `useTransform` + `animate` from `motion/react`.
  The `rounded.on("change")` listener updates local state for display. This avoids the lint rule
  against `useEffect` + `setState` syncing from SWR — this is an animation driver, not data sync.
- The stats row shows "X titles" (aggregated count) instead of "X movies" from the spec. This is
  intentional — a single aggregated number is more impactful than showing just the movie count, and
  "titles" covers all media types (movies + TV + anime).

- [ ] **Step 2: Verify the hero renders**

```bash
pnpm dev
```

Open `http://localhost:3000` in the browser (while logged out). Verify:

- Full-height hero with dark background
- Blurred poster backdrop (if stats have media with posters)
- "CDb" title, tagline, count-up stats, Log In / Sign Up buttons
- All elements animate in sequentially

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: cinematic landing page hero with poster backdrop and count-up stats"
```

---

## Task 2: Feature Grid Section

Add the 2x2 feature highlight grid below the hero.

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add the FeatureGrid component**

Add this component after the `HeroSection` function in `page.tsx`:

```tsx
const FEATURES = [
  {
    icon: ClapperboardIcon,
    title: "Track & Rate",
    description: "Log watch sessions and score them together",
    accent: "purple",
    gradient: "from-purple-500/10 to-purple-500/5",
    border: "border-purple-500/20",
    iconColor: "text-purple-400",
  },
  {
    icon: SparklesIcon,
    title: "Smart Recommendations",
    description: "AI-powered suggestions based on your group's taste",
    accent: "blue",
    gradient: "from-blue-500/10 to-blue-500/5",
    border: "border-blue-500/20",
    iconColor: "text-blue-400",
  },
  {
    icon: BarChart3Icon,
    title: "Stats & Insights",
    description: "Personal and group analytics on everything you watch",
    accent: "amber",
    gradient: "from-amber-500/10 to-amber-500/5",
    border: "border-amber-500/20",
    iconColor: "text-amber-400",
  },
  {
    icon: DicesIcon,
    title: "Games",
    description: "Poster reveal, year guesser, and more",
    accent: "green",
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
```

- [ ] **Step 2: Add FeatureGrid to the page JSX**

In the `LandingPage` component's return, add `<FeatureGrid />` after the hero section. The feature
grid is static content, so it renders regardless of loading/stats state:

```tsx
return (
  <main className="min-h-screen bg-black text-white">
    {isLoading || stats === null ? <HeroSkeleton /> : <HeroSection stats={stats} />}
    <FeatureGrid />
    {/* Top Rated and Ticker sections will go here */}
  </main>
);
```

- [ ] **Step 3: Verify the feature grid renders**

```bash
pnpm dev
```

Scroll below the hero. Verify:

- 2x2 grid of feature cards with colored gradients and borders
- Cards animate in on scroll (staggered)
- Each card has icon, title, description
- Responsive: 1 column on mobile, 2 columns on sm+

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add feature highlight grid to landing page"
```

---

## Task 3: Top Rated Poster Row

Replace the old top-rated list cards with a horizontal poster row.

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add the TopRatedRow component and skeleton**

Add after `FeatureGrid` in `page.tsx`:

```tsx
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
```

- [ ] **Step 2: Add TopRatedRow to the page JSX**

Update the page return to include the top rated section:

```tsx
return (
  <main className="min-h-screen bg-black text-white">
    {isLoading || stats === null ? <HeroSkeleton /> : <HeroSection stats={stats} />}
    <FeatureGrid />
    {isLoading ? <TopRatedSkeleton /> : stats !== null && <TopRatedRow stats={stats} />}
    {/* Ticker and Footer will go here */}
  </main>
);
```

- [ ] **Step 3: Verify the top rated row renders**

```bash
pnpm dev
```

Verify:

- Row of poster cards below the feature grid
- Each shows poster image, title, type badge, star rating
- Hover scale effect works
- Staggered animation on scroll
- Hidden entirely if no top-rated media

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add top-rated poster row to landing page"
```

---

## Task 4: Recently Watched Ticker

Add the auto-scrolling CSS marquee for recently watched media.

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add the Ticker component**

Add after `TopRatedRow` in `page.tsx`. This uses pure CSS animation with Tailwind for the marquee
effect:

```tsx
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

  // Duplicate items 3x for seamless loop on wide viewports
  const items = [...stats.recentMedia, ...stats.recentMedia, ...stats.recentMedia];

  return (
    <section className="border-t border-white/10 py-6">
      <div className="group relative overflow-hidden">
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
```

- [ ] **Step 2: Add the ticker CSS keyframes**

Add the `@keyframes` animation to the global CSS. Open `src/app/globals.css` and add the ticker
animation. Find the appropriate location (after existing Tailwind directives) and add:

```css
@keyframes ticker {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-33.333%);
  }
}

@utility animate-ticker {
  animation: ticker 30s linear infinite;
}
```

The `-33.333%` value works because we duplicated items 3x, so translating by 1/3 creates a seamless
loop back to the start. The `@utility` directive is required by Tailwind CSS v4 for custom utility
classes (see existing `animate-shake` pattern in `globals.css`).

- [ ] **Step 3: Add RecentTicker to the page JSX**

Update the page return:

```tsx
return (
  <main className="min-h-screen bg-black text-white">
    {isLoading || stats === null ? <HeroSkeleton /> : <HeroSection stats={stats} />}
    <FeatureGrid />
    {isLoading ? <TopRatedSkeleton /> : stats !== null && <TopRatedRow stats={stats} />}
    {stats !== null && <RecentTicker stats={stats} />}
    {/* Footer will go here */}
  </main>
);
```

Note: No skeleton for the ticker — it simply doesn't render while loading (per spec).

- [ ] **Step 4: Verify the ticker works**

```bash
pnpm dev
```

Verify:

- Smooth scrolling marquee of recent media
- Shows poster thumbnail, title, type badge, watch date for each
- Pauses on hover
- Loops seamlessly
- Hidden if no recent media

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/globals.css
git commit -m "feat: add recently watched scrolling ticker to landing page"
```

---

## Task 5: Footer Section

Add the minimal footer with CTAs, GitHub link, and copyright.

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add the Footer component**

Add after `RecentTicker` in `page.tsx`:

```tsx
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
            <GithubIcon className="size-5" />
          </a>
          <span>&copy; {String(new Date().getFullYear())} CDb</span>
        </div>
      </div>
    </motion.footer>
  );
}
```

- [ ] **Step 2: Add Footer to the page JSX**

Final page return:

```tsx
return (
  <main className="min-h-screen bg-black text-white">
    {isLoading || stats === null ? <HeroSkeleton /> : <HeroSection stats={stats} />}
    <FeatureGrid />
    {isLoading ? <TopRatedSkeleton /> : stats !== null && <TopRatedRow stats={stats} />}
    {stats !== null && <RecentTicker stats={stats} />}
    <LandingFooter />
  </main>
);
```

- [ ] **Step 3: Verify the footer renders**

```bash
pnpm dev
```

Verify:

- Log In / Sign Up buttons centered
- GitHub icon links to `https://github.com/harmgharm/CDb` (opens in new tab)
- Copyright shows current year dynamically
- Fades in on scroll

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add footer with CTAs, GitHub link, and copyright to landing page"
```

---

## Task 6: Final Assembly and Main Component Wiring

Wire up the `LandingPage` default export with the auth check, data fetch, and all sections. Clean up
any old code that wasn't replaced in earlier tasks.

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write the final LandingPage component**

Ensure the default export `LandingPage` function has the exact auth check + data fetch pattern from
the original, wired to the new sections:

```tsx
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
```

- [ ] **Step 2: Clean up — remove any leftover old components**

Ensure no old components remain in the file (`StatCard`, `StatsOverviewSection`, `RecentSection`,
`CARD_VARIANTS`, the old `StatsSkeleton`, `MediaCardSkeleton`, etc.). The file should only contain:

1. Imports
2. `PublicStats` interface
3. `CountUp` component
4. `HeroSkeleton` component
5. `HeroBackdrop` component
6. `HeroSection` component
7. `FEATURES` constant + `FeatureGrid` component
8. `TopRatedSkeleton` + `TopRatedRow` component
9. `formatDate` + `RecentTicker` component
10. `LandingFooter` component
11. `LandingPage` default export

- [ ] **Step 3: Run lint and typecheck**

```bash
pnpm lint && pnpm typecheck
```

Fix any lint errors. Common issues to watch for:

- `ease: "easeOut" as const` — required for Motion type safety
- `String()` wrappers in template literals for numbers/possibly-undefined values
- `value.length === 0` not `!value` for array/string checks
- Arrow wrappers in `.map()` if passing function refs

- [ ] **Step 4: Verify the full page end-to-end**

```bash
pnpm dev
```

Full verification checklist:

- [ ] Hero: poster backdrop, "CDb" title, tagline, count-up stats, CTAs
- [ ] Feature grid: 4 cards with colored accents, scroll animation
- [ ] Top rated: 5 poster cards with images, titles, ratings, type badges
- [ ] Ticker: scrolling marquee, pauses on hover, loops seamlessly
- [ ] Footer: CTAs, GitHub icon, copyright year
- [ ] Loading state: hero skeleton shows, feature grid renders immediately, poster skeletons show
- [ ] Auth redirect: if logged in, redirects to `/home`
- [ ] Mobile responsive: all sections stack/resize appropriately

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: complete cinematic landing page redesign"
```

---

## Task 7: Production Build Verification

Verify the page builds cleanly and works in production mode.

**Files:** None (verification only)

- [ ] **Step 1: Run production build**

```bash
pnpm build
```

Expected: Build succeeds with no errors. Watch for:

- next/image warnings about missing `sizes` props
- Motion/SSR issues (should be fine since we use `"use client"` + `motion/react-client`)

- [ ] **Step 2: Test production server**

```bash
pnpm start
```

Open `http://localhost:3000` while logged out. Verify the page works identically to dev mode. Check
the Network tab — images should be served through Next.js image optimization.

- [ ] **Step 3: Run full lint + typecheck + test suite**

```bash
pnpm lint && pnpm typecheck && pnpm test
```

All should pass. The landing page has no tests (it's a presentational page with no testable logic
beyond the existing auth flow), so existing tests should remain green.
