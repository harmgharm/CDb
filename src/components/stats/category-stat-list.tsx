"use client";

import { StarIcon } from "lucide-react";
import * as motion from "motion/react-client";

import type { DirectorStat, GenreStat, YearStat } from "@/types/detailed-stats";

type StatItem = GenreStat | DirectorStat | YearStat;

interface CategoryStatListProps {
  readonly items: readonly StatItem[];
  readonly label: string;
  /** Show avg score alongside count */
  readonly showScore?: boolean;
}

function getItemLabel(item: StatItem): string {
  if ("genre" in item) return item.genre;
  if ("director" in item) return item.director;
  return String(item.year);
}

/** Rotating palette for bar colors */
const BAR_COLORS = [
  "bg-blue-500/70",
  "bg-violet-500/70",
  "bg-cyan-500/70",
  "bg-rose-500/70",
  "bg-amber-500/70",
  "bg-emerald-500/70",
  "bg-indigo-500/70",
  "bg-pink-500/70",
];

export function CategoryStatList({ items, label, showScore = false }: CategoryStatListProps) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">Not enough data yet</p>;
  }

  const maxCount = Math.max(...items.map((item) => item.count));

  return (
    <div className="space-y-1.5">
      <h4 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        {label}
      </h4>
      <div className="space-y-1.5">
        {items.map((item, index) => {
          const barWidth = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          const itemLabel = getItemLabel(item);
          const barColor = BAR_COLORS[index % BAR_COLORS.length] ?? "bg-primary/30";

          return (
            <motion.div
              key={itemLabel}
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" as const }}
            >
              <span className="w-28 min-w-0 shrink-0 truncate text-sm">{itemLabel}</span>
              <div className="bg-muted/30 relative h-5 flex-1 overflow-hidden rounded-full">
                <motion.div
                  className={`absolute inset-y-0 left-0 rounded-full ${barColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${String(barWidth)}%` }}
                  transition={{
                    delay: 0.2 + index * 0.05,
                    duration: 0.5,
                    ease: "easeOut" as const,
                  }}
                />
                <span className="relative z-10 flex h-full items-center px-2 text-xs font-medium">
                  {String(item.count)}
                </span>
              </div>
              {showScore && item.avgScore !== null && (
                <div className="flex shrink-0 items-center gap-0.5">
                  <StarIcon className="size-3 fill-amber-500 text-amber-500" />
                  <span className="text-xs font-medium">{item.avgScore.toFixed(1)}</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
