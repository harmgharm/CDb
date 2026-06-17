"use client";

import * as motion from "motion/react-client";

import { Card } from "@/components/ui/card";
import type { MediaRating } from "@/types/media-responses";

/**
 * Group-average rating card for the media-detail header. Adapted from the kit's
 * `cdb-rating-card`: an eyebrow, a large serif average, and a 10-column score
 * histogram. The histogram is built client-side by bucketing `media.ratings`
 * into 1-10 (scores are 1.0-10.0 to one decimal, so we round to the nearest
 * whole bucket). Static by design: the individual ratings/reviews already live
 * in the session cards beside it, so there's no expand affordance here.
 */

interface GroupRatingCardProps {
  /** Group average (1.0-10.0), or null when nobody has rated yet. */
  readonly avgRating: number | null;
  /** Total number of individual ratings backing the average. */
  readonly ratingCount: number;
  /** The full set of individual ratings, bucketed for the histogram. */
  readonly ratings: MediaRating[];
}

/** Bucket scores into 1-10 by rounding (7.4 -> 7, 7.5 -> 8). */
function bucketScores(ratings: MediaRating[]): number[] {
  const counts = new Map<number, number>();
  for (const rating of ratings) {
    const bucket = Math.min(10, Math.max(1, Math.round(rating.score)));
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  return Array.from({ length: 10 }, (_, index) => counts.get(index + 1) ?? 0);
}

function RatingHistogram({
  ratings,
  avgBucket,
}: {
  readonly ratings: MediaRating[];
  readonly avgBucket: number;
}) {
  const counts = bucketScores(ratings);
  const maxCount = Math.max(...counts, 1);

  return (
    <div className="mt-4">
      <div className="grid h-14 grid-cols-10 items-end gap-1">
        {counts.map((count, index) => {
          const score = index + 1;
          const isAvg = score === avgBucket;
          const heightPercent = (count / maxCount) * 100;
          return (
            <div key={score} className="flex h-full items-end justify-center">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${String(heightPercent)}%` }}
                transition={{
                  delay: 0.05 + index * 0.03,
                  duration: 0.5,
                  ease: "easeOut" as const,
                }}
                className={`min-h-0.5 w-full rounded-sm ${
                  isAvg ? "bg-[var(--cdb-marquee)]" : "bg-[var(--bg-elev-3)]"
                }`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-[var(--fg-dim)]">
        <span>1</span>
        <span>5</span>
        <span>10</span>
      </div>
    </div>
  );
}

export function GroupRatingCard({ avgRating, ratingCount, ratings }: GroupRatingCardProps) {
  const isEmpty = avgRating === null || ratingCount === 0;

  return (
    <Card className="p-5">
      <p className="text-muted-foreground font-mono text-[11px] tracking-[0.16em] uppercase">
        Group average
      </p>

      {isEmpty ? (
        // Keep the frame so the layout doesn't jump; no flat-zero chart or "—/10".
        <div className="mt-4">
          <p className="text-sm font-medium">No ratings yet.</p>
          <p className="text-muted-foreground mt-1 text-sm">Rate to see the group&apos;s score.</p>
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-[56px] leading-none font-normal tracking-tight">
              {avgRating.toFixed(1)}
            </span>
            <div className="flex flex-col">
              <span className="text-muted-foreground text-sm">/ 10</span>
              <span className="text-muted-foreground text-xs">
                {String(ratingCount)} {ratingCount === 1 ? "rating" : "ratings"}
              </span>
            </div>
          </div>

          <RatingHistogram ratings={ratings} avgBucket={Math.round(avgRating)} />
        </>
      )}
    </Card>
  );
}
