"use client";

import { ArrowRightIcon, ImageIcon } from "lucide-react";
import Link from "next/link";

import { getClientGameConfig } from "@/lib/games/client-config";
import type { LiveSessionResponse } from "@/types/game-responses";

/**
 * Play hub's "Live now" card — in-progress multiplayer sessions across the
 * group. Cherry is reserved exclusively for this live-multiplayer signal
 * (never the static game cards above it) per the design system's copy rules.
 */

function LiveSessionRow({ session }: Readonly<{ session: LiveSessionResponse }>) {
  const config = getClientGameConfig(session.gameType);
  const href = `${config?.basePath ?? "/play"}/${session.id}`;
  const GameIcon = config?.icon ?? ImageIcon;

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--bg-elev-3)] p-3 transition-colors hover:border-[color-mix(in_oklch,var(--cdb-marquee)_55%,transparent)]"
    >
      <div className="text-cdb-cherry-hi flex size-8 shrink-0 items-center justify-center rounded-sm border border-[color-mix(in_oklch,var(--cdb-cherry)_25%,transparent)] bg-[color-mix(in_oklch,var(--cdb-cherry)_16%,transparent)]">
        <GameIcon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium">{session.title}</div>
        <div className="mt-0.5 truncate text-[11px] text-[var(--fg-muted)]">{session.meta}</div>
      </div>
      <ArrowRightIcon className="size-3.5 shrink-0 text-[var(--fg-dim)]" />
    </Link>
  );
}

export function HubLiveNow({ sessions }: Readonly<{ sessions: readonly LiveSessionResponse[] }>) {
  return (
    <div className="bg-card flex flex-col gap-3.5 rounded-lg border px-5 pt-[18px] pb-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Live now</h3>
        {sessions.length > 0 && (
          <span className="text-cdb-cherry-hi inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklch,var(--cdb-cherry)_12%,transparent)] px-2.5 py-0.5 text-xs">
            <span className="bg-cdb-cherry-hi animate-up-next-pulse size-1.5 rounded-full" />
            {sessions.length} active
          </span>
        )}
      </div>
      {sessions.length === 0 ? (
        <p className="text-muted-foreground text-sm">No multiplayer games in progress</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {sessions.map((session) => (
            <LiveSessionRow key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
