"use client";

import { Clapperboard } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/branding/wordmark";
import type { ApiResponse } from "@/lib/api/response";
import { cn } from "@/lib/utils";

import type { PublicStats } from "../../_landing/types";

const POSTER_SLOTS = [
  { layer: "bg", position: "top-[-10%] left-[-8%]", rotate: -8 },
  { layer: "bg", position: "top-[18%] right-[-12%]", rotate: 6 },
  { layer: "bg", position: "bottom-[-14%] left-[32%]", rotate: -4 },
  { layer: "fg", position: "top-[14%] left-[8%]", rotate: -6 },
  { layer: "fg", position: "top-[32%] right-[10%]", rotate: 5 },
  { layer: "fg", position: "bottom-[6%] left-[32%]", rotate: -3 },
] as const;

const FALLBACK_GRADIENTS = [
  "linear-gradient(155deg, oklch(0.35 0.18 30), oklch(0.18 0.10 350))",
  "linear-gradient(155deg, oklch(0.55 0.22 320), oklch(0.25 0.18 280))",
  "linear-gradient(155deg, oklch(0.35 0.15 200), oklch(0.20 0.10 250))",
  "linear-gradient(155deg, oklch(0.45 0.20 0), oklch(0.20 0.10 350))",
  "linear-gradient(155deg, oklch(0.30 0.10 60), oklch(0.10 0.04 40))",
  "linear-gradient(155deg, oklch(0.40 0.15 100), oklch(0.15 0.08 80))",
] as const;

const LAYER_CLASSES = {
  bg: "w-[38%] opacity-55 blur-[28px] saturate-[1.1] z-[1]",
  fg: "w-[24%] opacity-[0.78] saturate-[1.05] z-[2]",
} as const;

export function AuthArtPanel() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      try {
        const response = await fetch("/api/stats/public");
        const json = (await response.json()) as ApiResponse<PublicStats>;
        if (!cancelled && json.error === null) {
          setStats(json.data);
        }
      } catch {
        // Silently fall back to gradient slots — panel is decorative.
      }
    }
    void loadStats();
    return () => {
      cancelled = true;
    };
  }, []);

  const posters = stats?.topMedia ?? [];
  const totalTitles = stats === null ? null : sumMediaCounts(stats.mediaWatched);
  const memberCount = stats?.memberCount ?? null;

  return (
    <div
      className="relative hidden items-center justify-center overflow-hidden lg:flex"
      style={{ background: "#050403", isolation: "isolate" }}
    >
      {POSTER_SLOTS.map((slot, index) => {
        const poster = posters[index];
        const posterUrl = poster?.posterUrl ?? null;
        return (
          <div
            key={index}
            className={cn(
              "absolute aspect-[2/3] overflow-hidden rounded-xl",
              "shadow-[0_30px_80px_rgb(0_0_0/0.7),0_0_0_1px_rgb(255_255_255/0.04)]",
              slot.position,
              LAYER_CLASSES[slot.layer],
            )}
            style={{ transform: `rotate(${String(slot.rotate)}deg)` }}
            aria-hidden="true"
          >
            {posterUrl === null ? (
              <div
                className="h-full w-full"
                style={{ backgroundImage: FALLBACK_GRADIENTS[index] }}
              />
            ) : (
              <Image
                src={posterUrl}
                alt=""
                fill
                sizes="(max-width: 1024px) 0px, 40vw"
                className="object-cover"
              />
            )}
            {slot.layer === "fg" && poster !== undefined && (
              <div className="font-display absolute right-2.5 bottom-2.5 left-2.5 text-[18px] leading-[0.95] tracking-tight text-white/90 [text-shadow:0_2px_12px_rgb(0_0_0/0.6)]">
                {poster.title}
              </div>
            )}
          </div>
        );
      })}

      <div
        className="absolute inset-0 z-[3]"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, rgb(5 4 3 / 0.2) 0%, rgb(5 4 3 / 0.7) 70%, rgb(5 4 3 / 0.95) 100%), linear-gradient(105deg, rgb(5 4 3 / 0.5) 0%, rgb(5 4 3 / 0.7) 70%, var(--bg) 100%)",
        }}
        aria-hidden="true"
      />
      <div
        className="cdb-grain z-[4]"
        style={{ "--cdb-grain-opacity": "0.18" } as React.CSSProperties}
      />

      <div className="relative z-[5] flex max-w-[460px] flex-col items-center gap-6 px-8 text-center">
        <div className="inline-flex items-center gap-3.5">
          <div
            className="bg-cdb-marquee grid h-12 w-12 place-items-center rounded-md shadow-[0_0_24px_color-mix(in_oklch,var(--cdb-marquee)_45%,transparent)]"
            style={{ color: "var(--cdb-ink-950)" }}
          >
            <Clapperboard size={22} strokeWidth={2} />
          </div>
          <Wordmark size="xl" className="text-cdb-cream" />
        </div>

        <p className="font-display max-w-[320px] text-base text-white/80 italic">
          A screening room your group keeps coming back to.
        </p>

        <div className="font-mono text-[10px] tracking-[0.16em] text-white/55 uppercase">
          <CreditLine totalTitles={totalTitles} memberCount={memberCount} />
        </div>
      </div>
    </div>
  );
}

interface CreditLineProps {
  readonly totalTitles: number | null;
  readonly memberCount: number | null;
}

function CreditLine({ totalTitles, memberCount }: CreditLineProps) {
  const titlesLabel = totalTitles === null ? "loading" : `${String(totalTitles)} titles`;
  const friendsLabel = memberCount === null ? "" : ` · ${String(memberCount)} friends`;

  return (
    <span className="inline-flex items-center gap-3.5">
      <span className="block h-px w-9 bg-white/25" />
      <span>
        Now showing · {titlesLabel}
        {friendsLabel}
      </span>
      <span className="block h-px w-9 bg-white/25" />
    </span>
  );
}

function sumMediaCounts(mediaWatched: Record<string, number>): number {
  let total = 0;
  for (const count of Object.values(mediaWatched)) {
    total += count;
  }
  return total;
}
