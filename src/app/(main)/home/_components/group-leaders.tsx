"use client";

import { ChevronRightIcon, StarIcon } from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PickerLeaderboardEntry } from "@/types/detailed-stats";

/**
 * Group leaders list: the top members by picks, with avatar, name, a picks +
 * avg-rating meta line, and the avg score. Fed by the same picker-leaderboard
 * aggregate that powers Deep Cuts, so no extra query. Lives in the left column
 * of the dashboard's leaders / viewing-habits two-column row.
 */

function getInitials(displayName: string | null, username: string): string {
  return (displayName ?? username).slice(0, 2).toUpperCase();
}

function LeaderRow({ leader, rank }: Readonly<{ leader: PickerLeaderboardEntry; rank: number }>) {
  const name = leader.displayName ?? leader.username;
  const meta = `${String(leader.pickCount)} picks · ${String(leader.watchedCount)} watched`;

  return (
    <Link
      href={`/users/${leader.userId}`}
      className="hover:bg-accent/40 flex items-center gap-3 rounded-md px-1 py-2 transition-colors"
    >
      <span className="w-4 text-center font-mono text-xs text-[var(--fg-muted)]">{rank + 1}</span>
      <Avatar className="size-8">
        <AvatarImage src={leader.avatarUrl ?? undefined} alt={name} />
        <AvatarFallback className="text-xs">
          {getInitials(leader.displayName, leader.username)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px]">{name}</div>
        <div className="mt-px text-[11px] text-[var(--fg-muted)]">{meta}</div>
      </div>
      {leader.avgPickRating !== null && (
        <span className="inline-flex items-center gap-1 font-mono text-[13px] font-medium">
          <StarIcon className="size-[11px] fill-amber-500 text-amber-500" />
          {leader.avgPickRating.toFixed(1)}
        </span>
      )}
    </Link>
  );
}

export function GroupLeaders({
  leaders,
}: Readonly<{ leaders: readonly PickerLeaderboardEntry[] }>) {
  return (
    <div className="bg-card flex flex-col gap-3.5 rounded-lg border px-5 pt-[18px] pb-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Group leaders</h3>
        <Link
          href="/users"
          className="hover:text-foreground inline-flex items-center gap-1 text-xs text-[var(--fg-muted)] transition-colors"
        >
          All users <ChevronRightIcon className="size-3" />
        </Link>
      </div>
      {leaders.length === 0 ? (
        <p className="text-muted-foreground text-sm">No picks recorded yet</p>
      ) : (
        <div className="flex flex-col gap-1">
          {leaders.slice(0, 5).map((leader, index) => (
            <LeaderRow key={leader.userId} leader={leader} rank={index} />
          ))}
        </div>
      )}
    </div>
  );
}
