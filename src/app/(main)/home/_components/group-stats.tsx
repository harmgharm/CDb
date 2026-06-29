"use client";

import { HeartIcon, TrophyIcon, UsersIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/hooks/use-stats";

/**
 * "The cast this month": three human cards — Top Picker / Highest Rater /
 * Most Active — under an editorial eyebrow + rule header (kit's `cdb-cast`).
 * Same data as before (/api/stats topPicker/topRater/topAttendee), restyled to
 * the cast-card layout: tinted icon label, 48px avatar, serif name, mono stat.
 */

function displayName(name: string | null, username: string): string {
  return name ?? username;
}

function getInitials(name: string | null, username: string | null): string {
  const display = name ?? username ?? "?";
  return display
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function SectionHeader() {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="text-xs font-semibold tracking-[0.12em] text-[var(--fg-dim)] uppercase">
        The cast this month
      </span>
      <span className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}

function CastCardSkeleton() {
  return (
    <div className="bg-card flex flex-col gap-3 rounded-lg border px-4 py-3.5">
      <Skeleton className="h-3 w-24" />
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

interface CastCardProps {
  readonly label: string;
  readonly icon: React.ReactNode;
  readonly name: string | null;
  readonly stat: string | null;
  readonly avatarUrl: string | null;
  readonly initials: string;
}

function CastCard({ label, icon, name, stat, avatarUrl, initials }: Readonly<CastCardProps>) {
  return (
    <div className="bg-card flex flex-col gap-3 rounded-lg border px-4 py-3.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[10px] font-semibold tracking-[0.1em] text-[var(--fg-muted)] uppercase">
          {label}
        </span>
      </div>
      {name === null ? (
        <p className="text-muted-foreground text-sm">Not enough data yet</p>
      ) : (
        <div className="flex items-center gap-3">
          <Avatar className="size-12">
            <AvatarImage src={avatarUrl ?? undefined} alt={name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="font-display truncate text-[22px] leading-none tracking-[-0.015em]">
              {name}
            </div>
            {stat !== null && (
              <div className="font-mono text-[11px] tracking-[0.04em] text-[var(--fg-muted)]">
                {stat}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function GroupStats() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <section className="flex flex-col">
        <SectionHeader />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <CastCardSkeleton key={index} />
          ))}
        </div>
      </section>
    );
  }

  const cards: CastCardProps[] = [
    {
      label: "Top picker",
      icon: <TrophyIcon className="text-cdb-marquee-text size-3" />,
      name: stats?.topPicker
        ? displayName(stats.topPicker.displayName, stats.topPicker.username)
        : null,
      stat: stats?.topPicker ? `${String(stats.topPicker.pickCount)} picks` : null,
      avatarUrl: stats?.topPicker?.avatarUrl ?? null,
      initials: getInitials(
        stats?.topPicker?.displayName ?? null,
        stats?.topPicker?.username ?? null,
      ),
    },
    {
      label: "Highest rater",
      icon: <HeartIcon className="size-3 text-rose-500" />,
      name: stats?.topRater
        ? displayName(stats.topRater.displayName, stats.topRater.username)
        : null,
      stat: stats?.topRater ? `${String(stats.topRater.avgScore)} avg` : null,
      avatarUrl: stats?.topRater?.avatarUrl ?? null,
      initials: getInitials(
        stats?.topRater?.displayName ?? null,
        stats?.topRater?.username ?? null,
      ),
    },
    {
      label: "Most active",
      icon: <UsersIcon className="text-cdb-tv size-3" />,
      name: stats?.topAttendee
        ? displayName(stats.topAttendee.displayName, stats.topAttendee.username)
        : null,
      stat: stats?.topAttendee ? `${String(stats.topAttendee.attendanceCount)} sessions` : null,
      avatarUrl: stats?.topAttendee?.avatarUrl ?? null,
      initials: getInitials(
        stats?.topAttendee?.displayName ?? null,
        stats?.topAttendee?.username ?? null,
      ),
    },
  ];

  return (
    <section className="flex flex-col">
      <SectionHeader />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <CastCard key={card.label} {...card} />
        ))}
      </div>
    </section>
  );
}
