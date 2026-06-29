"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { ImportMediaDialog } from "@/components/media/import-media-dialog";
import { Button } from "@/components/ui/button";
import { useNowShowing } from "@/hooks/use-now-showing";
import { useQueue } from "@/hooks/use-queue";

/**
 * Editorial dashboard masthead: "Tuesday at CDb" with an italic amber accent on
 * the brand, a data-driven status subline, and a "Log session" action.
 *
 * The day of week respects the viewer's own system clock via the browser locale
 * (no server roundtrip). Computed in a useState initializer so it is stable
 * across renders and never triggers an effect-then-setState sync. Rendered
 * client-side to avoid a server/client locale mismatch on hydration.
 *
 * The subline now reads live data: the count of queue proposals up for the vote
 * and the count of in-progress (still-rating) sessions, matching the kit's
 * "4 up for the vote · 2 still rating." When there is nothing to report it falls
 * back to a quiet evergreen line.
 *
 * "Log session" opens the same media search/import dialog the queue's "Propose
 * a title" button uses: pick a title, then log the session against it (the app
 * has no title-agnostic log flow by design).
 */

const FALLBACK_SUBLINE = "Here's what the group has been watching.";

function currentWeekday(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

function buildSubline(proposalCount: number, ratingCount: number): string {
  const parts: string[] = [];
  if (proposalCount > 0) {
    parts.push(`${String(proposalCount)} up for the vote`);
  }
  if (ratingCount > 0) {
    parts.push(`${String(ratingCount)} still rating`);
  }
  if (parts.length === 0) return FALLBACK_SUBLINE;
  return `${parts.join(" · ")}.`;
}

export function DashboardHeader() {
  const [weekday] = useState(currentWeekday);
  const [importOpen, setImportOpen] = useState(false);

  const { proposals } = useQueue();
  const { items } = useNowShowing();
  const ratingCount = items.filter((item) => item.status === "in-progress").length;
  const subline = buildSubline(proposals.length, ratingCount);

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[44px] leading-none font-normal tracking-[-0.015em]">
          {weekday} at <em className="text-cdb-marquee-text italic">CDb</em>
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{subline}</p>
      </div>
      <Button
        onClick={() => {
          setImportOpen(true);
        }}
      >
        <PlusIcon className="size-3.5" /> Log session
      </Button>
      <ImportMediaDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => {
          setImportOpen(false);
        }}
      />
    </header>
  );
}
