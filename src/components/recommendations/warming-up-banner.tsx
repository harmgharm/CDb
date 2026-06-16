"use client";

import { DatabaseIcon, StarIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The not-yet-personalized "still warming up" state for For You. Replaces the
 * small Card + Progress block with an asymmetric poster collage, scrim, and
 * film grain (the Phase 3 landing hero treatment, scaled to a banner) beside a
 * body that conveys the same progress info: how many more ratings unlock the
 * personalized feed.
 *
 * Threshold and counts come from the recommendations meta (ratingCount /
 * ratingsNeeded / the MIN_RATINGS_FOR_PERSONALIZED constant), not hardcoded, so
 * this stays in lockstep with the rec engine's gate.
 */

// Asymmetric collage slots, scaled down from the landing PosterStack so the art
// reads as a band rather than a full-screen hero. Three sharper foreground
// pieces interleaved with two blurred background pieces.
const SLOTS = [
  { layer: "bg", position: "left-[2%] top-[14%]", rotate: -7, fallback: "g0" },
  { layer: "fg", position: "left-[20%] top-[40%]", rotate: 4, fallback: "g1" },
  { layer: "fg", position: "right-[26%] top-[10%]", rotate: 6, fallback: "g2" },
  { layer: "bg", position: "right-[4%] top-[36%]", rotate: -5, fallback: "g3" },
  { layer: "fg", position: "right-[10%] top-[58%]", rotate: -3, fallback: "g4" },
] as const;

const FALLBACK_GRADIENTS: Record<string, string> = {
  g0: "linear-gradient(160deg, oklch(0.35 0.18 30) 0%, oklch(0.18 0.10 350) 100%)",
  g1: "linear-gradient(135deg, oklch(0.55 0.22 320) 0%, oklch(0.25 0.18 280) 100%)",
  g2: "linear-gradient(150deg, oklch(0.35 0.15 200) 0%, oklch(0.20 0.10 250) 100%)",
  g3: "linear-gradient(160deg, oklch(0.30 0.10 60) 0%, oklch(0.10 0.04 40) 100%)",
  g4: "linear-gradient(135deg, oklch(0.45 0.20 0) 0%, oklch(0.20 0.10 350) 100%)",
};

const LAYER_CLASSES = {
  fg: "w-[22%] opacity-[0.78] blur-[0.5px] saturate-[1.05]",
  bg: "w-[16%] opacity-[0.42] blur-[8px] saturate-[1.1]",
} as const;

function WarmupCollage({ posters }: Readonly<{ posters: readonly (string | null)[] }>) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {SLOTS.map((slot, index) => {
        const posterUrl = posters[index] ?? null;
        return (
          <motion.div
            key={slot.fallback}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: slot.layer === "fg" ? 0.78 : 0.42, scale: 1 }}
            transition={{ delay: index * 0.08, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{ transform: `rotate(${String(slot.rotate)}deg)` }}
            className={cn(
              "absolute aspect-[2/3] overflow-hidden rounded-[8px]",
              "shadow-[0_20px_60px_rgb(0_0_0/0.6),0_0_0_1px_rgb(255_255_255/0.04)]",
              slot.position,
              LAYER_CLASSES[slot.layer],
            )}
          >
            {posterUrl === null ? (
              <div
                className="h-full w-full"
                style={{ backgroundImage: FALLBACK_GRADIENTS[slot.fallback] }}
              />
            ) : (
              <Image src={posterUrl} alt="" fill sizes="22vw" className="object-cover" />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

interface WarmingUpBannerProps {
  /** How many titles the current user has rated. */
  readonly ratingCount: number;
  /** How many more ratings unlock the personalized feed. */
  readonly ratingsNeeded: number;
  /** The personalization threshold (MIN_RATINGS_FOR_PERSONALIZED). */
  readonly threshold: number;
  /** Poster URLs to seed the collage; padded with gradient fallbacks. */
  readonly posters: readonly (string | null)[];
}

export function WarmingUpBanner({
  ratingCount,
  ratingsNeeded,
  threshold,
  posters,
}: WarmingUpBannerProps) {
  const progressPercent = Math.min(100, Math.round((ratingCount / threshold) * 100));
  const remainingLabel = `${String(ratingsNeeded)} more title${ratingsNeeded === 1 ? "" : "s"}`;

  return (
    <div className="relative isolate overflow-hidden rounded-xl border bg-[#060403]">
      <WarmupCollage posters={posters} />

      <div
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "linear-gradient(to right, rgba(6,4,3,0.97) 0%, rgba(6,4,3,0.88) 45%, rgba(6,4,3,0.55) 100%)",
        }}
        aria-hidden="true"
      />
      <div className="cdb-grain z-20" aria-hidden="true" />

      <div className="text-cdb-cream relative z-30 max-w-[640px] p-8 sm:p-10">
        <p className="font-mono text-[11px] tracking-[0.16em] text-white/55 uppercase">
          Still warming up
        </p>
        <h2 className="font-display mt-3 text-[clamp(28px,4vw,40px)] leading-[1.05] font-normal tracking-[-0.02em]">
          Rate <em className="text-cdb-marquee-text italic">{remainingLabel}</em> to unlock your
          feed.
        </h2>
        <p className="mt-3 text-sm leading-[1.5] text-white/70">
          We weigh your recent ratings against the group&apos;s history. A few more and your
          personalized recommendations open up.
        </p>

        <div className="mt-6 flex items-center gap-4">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
            <div
              className="bg-cdb-marquee h-full rounded-full transition-[width] duration-500"
              style={{ width: `${String(progressPercent)}%` }}
            />
          </div>
          <span className="shrink-0 text-sm text-white/70 tabular-nums">
            <span className="font-semibold text-white">{String(ratingCount)}</span> of{" "}
            {String(threshold)} rated
          </span>
        </div>

        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/database">
              <StarIcon className="mr-2 size-4" />
              Rate a title
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/database">
              <DatabaseIcon className="mr-2 size-4" />
              Browse database
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
