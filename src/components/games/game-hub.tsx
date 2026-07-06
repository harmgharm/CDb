"use client";

/**
 * GameHubContent — Play hub landing page: game type cards, group leaderboard,
 * and in-progress multiplayer sessions.
 */

import { ArrowRightIcon } from "lucide-react";
import * as motion from "motion/react-client";
import Link from "next/link";

import { HubLeaderboard } from "@/components/games/hub-leaderboard";
import { HubLiveNow } from "@/components/games/hub-live-now";
import { PlayHubHeader } from "@/components/games/play-hub-header";
import { usePlayHub } from "@/hooks/use-play-hub";
import { getAllGameConfigs } from "@/lib/games/client-config";

export function GameHubContent() {
  const games = getAllGameConfigs();
  const { leaderboard, liveSessions } = usePlayHub();

  return (
    <div className="mx-auto max-w-[1200px] space-y-8 px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" as const }}
        className="space-y-8"
      >
        <PlayHubHeader />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <Link
              key={game.basePath}
              href={game.basePath}
              className="bg-card flex flex-col gap-2 rounded-xl border border-[var(--border)] p-[22px] pb-5 transition-colors hover:border-[color-mix(in_oklch,var(--cdb-marquee)_55%,transparent)]"
            >
              <div className="mb-1.5 flex size-12 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-elev-3)] text-[var(--fg)]">
                <game.icon className="size-6" />
              </div>
              <h3 className="text-lg font-semibold">{game.displayName}</h3>
              <p className="text-[13px] leading-[1.45] text-[var(--fg-muted)]">
                {game.description}
              </p>
              <div className="mt-3.5 flex items-center justify-between text-[11px] tracking-[0.08em] text-[var(--fg-dim)] uppercase">
                <span>Solo · Multiplayer</span>
                <ArrowRightIcon className="size-3.5" />
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <HubLeaderboard entries={leaderboard} />
          <HubLiveNow sessions={liveSessions} />
        </div>
      </motion.div>
    </div>
  );
}
