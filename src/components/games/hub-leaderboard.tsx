"use client";

import { TrophyIcon } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { GroupLeaderboardEntryResponse } from "@/types/game-responses";

/**
 * Play hub's "Game leaderboard" card — top group members by win rate across
 * all game types combined (all-time, per the design-system-second-pass
 * "Play hub" judgment calls: the kit's "This month" scope isn't backed by
 * any time-windowed data, so this reads "All time" instead).
 */

function getInitials(displayName: string | null, username: string): string {
  return (displayName ?? username).slice(0, 2).toUpperCase();
}

function LeaderRow({ entry }: Readonly<{ entry: GroupLeaderboardEntryResponse }>) {
  const name = entry.displayName ?? entry.username;
  const meta = `${String(entry.gamesWon)} wins · ${String(entry.gamesPlayed)} played`;

  return (
    <Link
      href={`/users/${entry.userId}`}
      className="hover:bg-accent/40 flex items-center gap-3 rounded-md px-1 py-2 transition-colors"
    >
      <span
        className="w-4 text-center font-mono text-xs text-[var(--fg-muted)]"
        style={entry.rank === 1 ? { color: "var(--cdb-marquee)" } : undefined}
      >
        {entry.rank}
      </span>
      <Avatar className="size-8">
        <AvatarImage src={entry.avatarUrl ?? undefined} alt={name} />
        <AvatarFallback className="text-xs">
          {getInitials(entry.displayName, entry.username)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px]">{name}</div>
        <div className="mt-px text-[11px] text-[var(--fg-muted)]">{meta}</div>
      </div>
      <span className="font-mono text-[13px] font-medium">{entry.winRate}%</span>
    </Link>
  );
}

export function HubLeaderboard({
  entries,
}: Readonly<{ entries: readonly GroupLeaderboardEntryResponse[] }>) {
  return (
    <div className="bg-card flex flex-col gap-3.5 rounded-lg border px-5 pt-[18px] pb-5">
      <div className="flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
          <TrophyIcon className="size-3.5 text-[var(--cdb-marquee)]" />
          Game leaderboard
        </h3>
        <span className="text-xs text-[var(--fg-muted)]">All time</span>
      </div>
      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">No games played yet</p>
      ) : (
        <div className="flex flex-col gap-1">
          {entries.map((entry) => (
            <LeaderRow key={entry.userId} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
