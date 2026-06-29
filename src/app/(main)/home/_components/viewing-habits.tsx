"use client";

import { PlayIcon } from "lucide-react";

import type { GroupDetailedStats } from "@/types/detailed-stats";

/**
 * Viewing-habits card: a best-streak header, a Monday-through-Sunday session
 * bar chart, and a meta row (busiest slot / avg start / avg length).
 *
 * Replaces the old four-card hero stat row. Streak and avg-start moved here;
 * hours and avg-rating already live in the 7-up stat strip, so nothing is lost.
 *
 * The peak day's bar is amber; the rest are quiet. `weekday` is precomputed
 * server-side (Monday-first, one flagged peak) by `buildWeekdayHistogram`.
 */

type WatchingHabits = GroupDetailedStats["watchingHabits"];

function formatTime12h(time24: string): string {
  const [hoursString = "0", minutesString = "00"] = time24.split(":");
  const hours = Number(hoursString);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(displayHours)}:${minutesString} ${period}`;
}

function StreakHeader({ habits }: Readonly<{ habits: WatchingHabits }>) {
  const activeLine =
    habits.currentStreak > 0
      ? `currently · active streak of ${String(habits.currentStreak)}`
      : "no active streak";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b pb-4">
      <div className="flex items-center gap-3">
        <span className="bg-cdb-marquee/15 text-cdb-marquee-text grid size-[30px] place-items-center rounded-md shadow-[0_0_16px_color-mix(in_oklch,var(--cdb-marquee)_28%,transparent)]">
          <PlayIcon className="size-3.5" />
        </span>
        <div className="text-cdb-marquee-text font-display text-[42px] leading-[0.95] tracking-[-0.02em]">
          {habits.longestStreak}
          <span className="ml-2 font-sans text-[11px] font-semibold tracking-[0.08em] text-[var(--fg-muted)] uppercase">
            day best streak
          </span>
        </div>
      </div>
      <div className="text-xs text-[var(--fg-dim)]">{activeLine}</div>
    </div>
  );
}

function WeekdayChart({ weekday }: Readonly<{ weekday: WatchingHabits["weekday"] }>) {
  const max = Math.max(1, ...weekday.map((d) => d.count));

  return (
    <div className="grid h-[130px] grid-cols-7 items-end gap-3 pt-[18px]">
      {weekday.map((d) => {
        const pct = (d.count / max) * 100;
        return (
          <div key={d.day} className="relative flex h-full flex-col items-center gap-2">
            <div className="relative flex w-full flex-1 items-end">
              <div
                className={`min-h-[4px] w-full rounded-t-[3px] transition-[height] duration-200 ${
                  d.isPeak ? "bg-cdb-marquee" : "bg-[var(--bg-elev-3)]"
                }`}
                style={{ height: `${String(pct)}%` }}
              />
              {d.isPeak && d.count > 0 && (
                <div className="text-cdb-marquee-text font-display absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full text-base">
                  {d.count}
                </div>
              )}
            </div>
            <div
              className={`font-mono text-[10px] tracking-[0.1em] uppercase ${
                d.isPeak ? "text-cdb-marquee-text" : "text-[var(--fg-dim)]"
              }`}
            >
              {d.day}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetaCell({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="flex flex-1 flex-col gap-0.5">
      <div className="text-[10px] font-semibold tracking-[0.1em] text-[var(--fg-dim)] uppercase">
        {label}
      </div>
      <div className="font-display text-lg leading-[1.1] tracking-[-0.01em]">{children}</div>
    </div>
  );
}

function MetaDivider() {
  return <div className="w-px bg-[var(--border)]" />;
}

export function ViewingHabits({ habits }: Readonly<{ habits: WatchingHabits }>) {
  const peak = habits.weekday.find((d) => d.isPeak);

  return (
    <div className="flex flex-col gap-4">
      <StreakHeader habits={habits} />
      <WeekdayChart weekday={habits.weekday} />
      <div className="flex items-stretch gap-4 border-t pt-3.5">
        <MetaCell label="Slot">
          {peak === undefined ? (
            <span className="text-[var(--fg-muted)]">No pattern yet</span>
          ) : (
            <>
              <em className="text-cdb-marquee-text italic">{peak.day}</em> nights
            </>
          )}
        </MetaCell>
        <MetaDivider />
        <MetaCell label="Avg start">
          <span className="font-mono text-[15px] tracking-[0.02em]">
            {habits.avgStartTime === null ? "—" : formatTime12h(habits.avgStartTime)}
          </span>
        </MetaCell>
        {habits.avgSessionLength !== null && (
          <>
            <MetaDivider />
            <MetaCell label="Avg length">
              <span className="font-mono text-[15px] tracking-[0.02em]">
                {habits.avgSessionLength}
              </span>
            </MetaCell>
          </>
        )}
      </div>
    </div>
  );
}
