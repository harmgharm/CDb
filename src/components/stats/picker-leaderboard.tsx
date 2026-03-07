"use client";

import { ChevronDownIcon, CrownIcon, StarIcon, TrophyIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";
import { useState } from "react";

import { MediaTypeBadge } from "@/components/media/media-type-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { PickerLeaderboardEntry } from "@/types/detailed-stats";

interface PickerLeaderboardProps {
  readonly pickers: readonly PickerLeaderboardEntry[];
}

function getInitials(displayName: string | null, username: string): string {
  const name = displayName ?? username;
  return name.slice(0, 2).toUpperCase();
}

const RANK_STYLES: Record<number, string> = {
  0: "text-amber-500",
  1: "text-gray-400",
  2: "text-amber-700",
};

function RankIcon({ rank }: Readonly<{ rank: number }>) {
  if (rank <= 2) {
    return <TrophyIcon className={`size-4 ${RANK_STYLES[rank] ?? ""}`} />;
  }
  return (
    <span className="text-muted-foreground w-4 text-center text-xs font-medium">
      {String(rank + 1)}
    </span>
  );
}

function PickerRow({ picker, rank }: Readonly<{ picker: PickerLeaderboardEntry; rank: number }>) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.1, duration: 0.3, ease: "easeOut" as const }}
    >
      <button
        type="button"
        className="hover:bg-accent/50 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors"
        onClick={() => {
          setExpanded((previous) => !previous);
        }}
      >
        <RankIcon rank={rank} />
        <Link
          href={`/users/${picker.userId}`}
          className="shrink-0"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          <Avatar className="size-8">
            <AvatarFallback className="text-xs">
              {getInitials(picker.displayName, picker.username)}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/users/${picker.userId}`}
            className="truncate text-sm font-medium hover:underline"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            {picker.displayName ?? picker.username}
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs">
            <CrownIcon className="mr-1 size-3" />
            {String(picker.pickCount)} picks
          </Badge>
          {picker.avgPickRating !== null && (
            <div className="flex items-center gap-0.5">
              <StarIcon className="size-3 fill-amber-500 text-amber-500" />
              <span className="text-sm font-medium">{picker.avgPickRating.toFixed(1)}</span>
            </div>
          )}
          {picker.topPicks.length > 0 && (
            <ChevronDownIcon
              className={`text-muted-foreground size-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            />
          )}
        </div>
      </button>

      {/* Top picks expandable area */}
      {expanded && picker.topPicks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="ml-14 space-y-1 pb-2"
        >
          <p className="text-muted-foreground text-xs">Top picks:</p>
          {picker.topPicks.map((pick) => (
            <Link
              key={pick.id}
              href={`/database/${pick.id}`}
              className="hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-1 transition-colors"
            >
              <span className="min-w-0 flex-1 truncate text-sm">{pick.title}</span>
              <MediaTypeBadge type={pick.type} />
              <div className="flex items-center gap-0.5">
                <StarIcon className="size-2.5 fill-amber-500 text-amber-500" />
                <span className="text-xs font-medium">{pick.avgScore.toFixed(1)}</span>
              </div>
            </Link>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

export function PickerLeaderboard({ pickers }: PickerLeaderboardProps) {
  if (pickers.length === 0) {
    return <p className="text-muted-foreground text-sm">No picks recorded yet</p>;
  }

  return (
    <div className="space-y-1">
      {pickers.map((picker, index) => (
        <PickerRow key={picker.userId} picker={picker} rank={index} />
      ))}
    </div>
  );
}
