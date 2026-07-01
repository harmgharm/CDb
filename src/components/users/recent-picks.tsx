"use client";

import { ArrowLeftIcon, ArrowRightIcon, StarIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { useState } from "react";

import { MediaPoster } from "@/components/media/media-poster";
import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecentPick } from "@/types/user-responses";

interface RecentPicksProps {
  readonly picks: RecentPick[];
}

/** Collapsed view shows one full 4-up row (the kit's grid width); the rest sit
 *  behind a "See all" toggle (the For You section's expand pattern). */
const COLLAPSED_COUNT = 4;

/** A pick whose group avg cleared the win threshold (7.0) reads as a win. */
const WIN_THRESHOLD = 7;

function PickCard({ pick, index }: { readonly pick: RecentPick; readonly index: number }) {
  const isWin = pick.avgScore !== null && pick.avgScore >= WIN_THRESHOLD;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      // Cap the stagger so a 20-pick expand doesn't trail in over a second.
      transition={{
        delay: 0.3 + Math.min(index, COLLAPSED_COUNT) * 0.05,
        duration: 0.3,
        ease: "easeOut" as const,
      }}
    >
      <Link
        href={`/database/${pick.media_id}`}
        className="group flex h-full flex-col rounded-lg border bg-[var(--bg-elev-3)] p-2.5 transition-colors hover:border-[color-mix(in_oklch,var(--cdb-marquee)_45%,transparent)]"
      >
        <div className="relative aspect-[2/3] overflow-hidden rounded-md">
          <MediaPoster posterUrl={pick.poster_url} title={pick.title} className="size-full" />
        </div>

        <div className="flex min-h-20 flex-col gap-1 px-0.5 pt-2.5">
          <span className="font-mono text-[10px] tracking-[0.1em] text-[var(--fg-dim)]">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h4 className="font-display line-clamp-2 text-lg leading-none tracking-[-0.015em]">
            {pick.title}
          </h4>
          <div className="mt-auto flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--fg-muted)]">
            <MediaTypeBadge type={pick.type} />
            {pick.release_year !== null && (
              <>
                <span aria-hidden="true" className="text-[var(--fg-dim)]">
                  ·
                </span>
                <span className="tabular-nums">{String(pick.release_year)}</span>
              </>
            )}
          </div>
          {pick.avgScore !== null && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
              <span className="flex items-center gap-1 font-semibold tabular-nums">
                <StarIcon className="size-2.5 fill-amber-500 text-amber-500" />
                {pick.avgScore.toFixed(1)}
              </span>
              <span className="text-[var(--fg-muted)]">/ 10 group avg</span>
              <span
                className={`ml-auto rounded px-1.5 py-0.5 text-[10px] leading-none font-bold ${
                  isWin ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500"
                }`}
              >
                {isWin ? "W" : "L"}
              </span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export function RecentPicks({ picks }: RecentPicksProps) {
  const [expanded, setExpanded] = useState(false);

  const visible = expanded ? picks : picks.slice(0, COLLAPSED_COUNT);
  const hiddenCount = picks.length - COLLAPSED_COUNT;
  const canExpand = hiddenCount > 0;

  return (
    <Card>
      <CardHeader>
        {/* No count: the kit's header is just "Recent picks", and "See all N
            more" below already surfaces the total when there's more than a row. */}
        <CardTitle className="text-sm font-medium">Recent picks</CardTitle>
      </CardHeader>
      <CardContent>
        {picks.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">No picks yet</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
              {visible.map((pick, index) => (
                <PickCard key={pick.session_id} pick={pick} index={index} />
              ))}
            </div>

            {canExpand && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setExpanded((previous) => !previous);
                  }}
                >
                  {expanded ? (
                    <>
                      <ArrowLeftIcon className="mr-1 size-3" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ArrowRightIcon className="mr-1 size-3" />
                      See all {String(hiddenCount)} more
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
