"use client";

import { StarIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";

import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Badge } from "@/components/ui/badge";
import type { DivisiveMedia, RankedMedia } from "@/types/detailed-stats";

interface RankedMediaListProps {
  readonly items: readonly RankedMedia[];
  readonly label: string;
  readonly showRank?: boolean;
}

export function RankedMediaList({ items, label, showRank = true }: RankedMediaListProps) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">Not enough data yet</p>;
  }

  return (
    <div className="space-y-1.5">
      <h4 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        {label}
      </h4>
      <div className="space-y-1">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" as const }}
          >
            <Link
              href={`/database/${item.id}`}
              className="hover:bg-accent/50 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors"
            >
              {showRank && (
                <span className="text-muted-foreground w-5 text-right text-xs font-medium">
                  {String(index + 1)}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
              <MediaTypeBadge type={item.type} />
              <div className="flex items-center gap-0.5">
                <StarIcon className="size-3 fill-amber-500 text-amber-500" />
                <span className="text-sm font-medium">{item.avgScore.toFixed(1)}</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Divisive Media List (shows stddev instead)
// ============================================

interface DivisiveMediaListProps {
  readonly items: readonly DivisiveMedia[];
  readonly label: string;
}

export function DivisiveMediaList({ items, label }: DivisiveMediaListProps) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-sm">Not enough data yet</p>;
  }

  return (
    <div className="space-y-1.5">
      <h4 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
        {label}
      </h4>
      <div className="space-y-1">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" as const }}
          >
            <Link
              href={`/database/${item.id}`}
              className="hover:bg-accent/50 flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors"
            >
              <span className="min-w-0 flex-1 truncate text-sm">{item.title}</span>
              <MediaTypeBadge type={item.type} />
              <Badge variant="outline" className="text-xs">
                <StarIcon className="mr-0.5 size-2.5 fill-amber-500 text-amber-500" />
                {item.avgScore.toFixed(1)}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                ±{item.stddev.toFixed(2)}
              </Badge>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
