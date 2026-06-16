"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/hooks/use-stats";

/**
 * Compact 7-up stat band. Replaces the old <StatsOverview> tile grid with a
 * single bordered card: Group avg, Movies, TV, Anime, Sessions, Ratings, Hours.
 * Same data (/api/stats), denser editorial layout.
 *
 * Dividers use --border-strong rather than --border so the seven cells stay
 * visually separated on the light (cream) surface, where --border reads faint.
 */

interface StatCell {
  readonly label: string;
  readonly value: string;
  readonly suffix?: string;
}

function StripCell({ cell, isFirst }: Readonly<{ cell: StatCell; isFirst: boolean }>) {
  // Dividers belong to the full 7-up row (lg+). Below that the strip wraps, so
  // every cell except the first gets a top border to keep rows separated; the
  // 7-col vertical dividers only switch on at lg, where the layout is one row.
  const divider = isFirst ? "" : "border-t border-[var(--border-strong)] lg:border-t-0 lg:border-l";
  return (
    <div className={`flex flex-col gap-1 px-[18px] py-4 ${divider}`}>
      <div className="text-[10px] font-semibold tracking-[0.08em] text-[var(--fg-muted)] uppercase">
        {cell.label}
      </div>
      <div className="font-display text-[28px] leading-none tracking-[-0.01em] tabular-nums">
        {cell.value}
        {cell.suffix !== undefined && (
          <span className="ml-[3px] font-sans text-xs text-[var(--fg-muted)]">{cell.suffix}</span>
        )}
      </div>
    </div>
  );
}

function StatStripSkeleton() {
  return (
    <div className="bg-card grid grid-cols-2 rounded-lg border sm:grid-cols-4 lg:grid-cols-7">
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className="flex flex-col gap-2 px-[18px] py-4">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-7 w-12" />
        </div>
      ))}
    </div>
  );
}

export function StatStrip() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return <StatStripSkeleton />;
  }

  const avgRating = stats?.avgRating ?? null;
  const hasAvg = avgRating !== null;
  const cells: StatCell[] = [
    {
      label: "Group avg",
      value: hasAvg ? avgRating.toFixed(1) : "—",
      suffix: hasAvg ? "/10" : undefined,
    },
    { label: "Movies", value: String(stats?.mediaWatched.movie ?? 0) },
    { label: "TV", value: String(stats?.mediaWatched.tv ?? 0) },
    { label: "Anime", value: String(stats?.mediaWatched.anime ?? 0) },
    { label: "Sessions", value: String(stats?.totalSessions ?? 0) },
    { label: "Ratings", value: String(stats?.totalRatings ?? 0) },
    { label: "Hours", value: String(stats?.hoursWatched ?? 0), suffix: "h" },
  ];

  return (
    <div className="bg-card grid grid-cols-2 rounded-lg border sm:grid-cols-4 lg:grid-cols-7">
      {cells.map((cell, index) => (
        <StripCell key={cell.label} cell={cell} isFirst={index === 0} />
      ))}
    </div>
  );
}
