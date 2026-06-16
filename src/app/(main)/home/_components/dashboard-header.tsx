"use client";

import { useState } from "react";

/**
 * Editorial dashboard masthead: "Tuesday at CDb" with an italic amber accent
 * on the brand, plus a one-line status subline.
 *
 * The day of week respects the viewer's own system clock via the browser
 * locale (no server roundtrip). Computed in a useState initializer so it is
 * stable across renders and never triggers an effect-then-setState sync.
 * Rendered client-side to avoid a server/client locale mismatch on hydration.
 *
 * The subline is intentionally a static line for now. The kit's data-driven
 * subtitle ("4 up for the vote · 2 still rating") depends on the group queue,
 * which does not exist until Phase 12. A live "N sessions logged recently"
 * counter was dropped: it can never be both cheap and accurate (the fetch caps
 * the count, so it understates active groups). Rebuild this as a real
 * data-driven subtitle in Phase 12 once the queue ships.
 */

const SUBLINE = "Here's what the group has been watching.";

function currentWeekday(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

export function DashboardHeader() {
  const [weekday] = useState(currentWeekday);

  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[44px] leading-none font-normal tracking-[-0.015em]">
          {weekday} at <em className="text-cdb-marquee-text italic">CDb</em>
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{SUBLINE}</p>
      </div>
    </header>
  );
}
