import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Editorial head + frame around a recommendation section, matching the kit's
 * `.cdb-fy-section-head`: a single ruled row whose left column stacks the issue
 * number (mono, uppercase, dim), the serif title, and the italic lede, with an
 * aside on the right (friend stack / source tag, plus the per-section refresh).
 *
 * Presentation only — the section body (poster row, dismiss, empty/loading,
 * the "See all" expand) stays in <RecommendationSection>. Previously the head
 * was split across both components (a number here, a separate `border-l-4`
 * title block there); the kit wants one head, so the title/lede live here now.
 */

/** Two-digit issue number from a zero-based index: 0 -> "01", 9 -> "10". */
export function sectionNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

interface NumberedSectionProps {
  /** The marker shown above the title, e.g. "01" or a "★" for Similar Titles. */
  readonly marker: string;
  /** Serif section title, e.g. "Based on your taste". */
  readonly title: string;
  /** Italic lede under the title, e.g. "Genres and directors you rate highly." */
  readonly description: string;
  /** Right-aligned aside, e.g. a friend stack or a "Source: TMDB" tag. */
  readonly aside?: React.ReactNode;
  /** Per-section refresh handler. Renders a refresh icon in the head aside. */
  readonly onRefresh?: () => void;
  readonly isRefreshing?: boolean;
  readonly className?: string;
  readonly children: React.ReactNode;
}

export function NumberedSection({
  marker,
  title,
  description,
  aside,
  onRefresh,
  isRefreshing = false,
  className,
  children,
}: NumberedSectionProps) {
  return (
    <section className={cn("flex flex-col gap-[18px]", className)}>
      <div className="flex items-end justify-between gap-6 border-b border-[var(--border)] pb-2">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[11px] tracking-[0.16em] text-[var(--fg-dim)] uppercase">
            {marker}
          </div>
          <h2 className="font-display mt-1 text-[36px] leading-none font-normal tracking-[-0.02em]">
            {title}
          </h2>
          <p className="font-display text-muted-foreground mt-1 text-sm italic">{description}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-4">
          {aside}
          {onRefresh !== undefined && (
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-8"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <RefreshCwIcon className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="sr-only">
                {isRefreshing ? `Refreshing ${title}` : `Refresh ${title}`}
              </span>
            </Button>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

/** The "Source: TMDB" aside tag for TMDB-sourced sections. */
export function SourceTag({ source }: Readonly<{ source: string }>) {
  return (
    <span className="text-muted-foreground font-mono text-[11px] tracking-[0.16em] uppercase">
      Source: {source}
    </span>
  );
}
