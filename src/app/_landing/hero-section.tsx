"use client";

import { LogInIcon, UserPlusIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import * as motion from "motion/react-client";
import Link from "next/link";

import { Wordmark } from "@/components/branding/wordmark";
import { Button } from "@/components/ui/button";

import { CountUp } from "./count-up";
import { PosterStack } from "./poster-stack";
import type { PublicStats } from "./types";

// Matches --ease-out from globals.css.
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

interface HeroSectionProps {
  readonly stats: PublicStats;
}

export function HeroSection({ stats }: HeroSectionProps) {
  const shouldReduceMotion = useReducedMotion();

  const posterUrls = stats.topMedia.map((m) => m.posterUrl);
  // Pad to 6 with recentMedia (deduped by title), then null fallback for remaining slots.
  const seenTitles = new Set(stats.topMedia.map((m) => m.title));
  const filler = stats.recentMedia
    .filter((m) => m.posterUrl !== null && !seenTitles.has(m.title))
    .map((m) => m.posterUrl);
  const sixPosters: (string | null)[] = [...posterUrls, ...filler].slice(0, 6);
  while (sixPosters.length < 6) {
    sixPosters.push(null);
  }

  const movies = stats.mediaWatched.movie ?? 0;
  const tv = stats.mediaWatched.tv ?? 0;
  const anime = stats.mediaWatched.anime ?? 0;
  const totalMedia = movies + tv + anime;

  // When reduced motion is requested, render at the final state with no animation.
  const stagger = (delay: number) =>
    shouldReduceMotion === true
      ? { initial: false, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y: -10 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.6, ease: EASE_OUT },
        };

  return (
    <section className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-[#060403]">
      <PosterStack posters={sixPosters} />

      {/* Radial + vertical scrim from the design system — anchors copy without flattening posters. */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background: `
            radial-gradient(ellipse 70% 60% at 50% 50%, rgba(6,4,3,0) 0%, rgba(6,4,3,0.55) 60%, rgba(6,4,3,0.95) 100%),
            linear-gradient(to bottom, rgba(6,4,3,0.4) 0%, rgba(6,4,3,0.2) 50%, rgba(6,4,3,1) 100%)
          `,
        }}
        aria-hidden="true"
      />

      <div className="cdb-grain z-20" aria-hidden="true" />

      <div className="text-cdb-cream relative z-30 flex flex-col items-center px-6 py-20 text-center">
        <motion.h1 {...stagger(0)} className="m-0">
          <Wordmark size="lg" className="block" />
        </motion.h1>

        <motion.p {...stagger(0.2)} className="mt-4 text-base text-white/75 sm:text-lg">
          Movie nights, logged.
        </motion.p>

        <motion.div
          {...stagger(0.5)}
          className="mt-6 flex items-center gap-3 text-sm text-white/65 tabular-nums sm:gap-4 sm:text-base"
        >
          <span>
            <b className="font-semibold text-white">
              <CountUp target={totalMedia} />
            </b>{" "}
            titles
          </span>
          <span className="text-white/25">&middot;</span>
          <span>
            <b className="font-semibold text-white">
              <CountUp target={stats.totalSessions} />
            </b>{" "}
            sessions
          </span>
          <span className="text-white/25">&middot;</span>
          <span>
            <b className="font-semibold text-white">
              <CountUp target={stats.hoursWatched} />
            </b>{" "}
            hours
          </span>
        </motion.div>

        <motion.div {...stagger(0.8)} className="mt-8 flex gap-3">
          <Button asChild size="lg">
            <Link href="/login">
              <LogInIcon className="mr-2 size-4" />
              Log in
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/signup">
              <UserPlusIcon className="mr-2 size-4" />
              Sign up
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
