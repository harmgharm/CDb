import { cn } from "@/lib/utils";

/**
 * Editorial chrome around a recommendation section: a serif issue number
 * ("01", "02", ...) in the left gutter and an optional aside on the right
 * (friend stack for collaborative sections, a source tag for TMDB sections).
 *
 * Presentation only. The section body (poster row, refresh, empty/loading
 * states) stays in <RecommendationSection>; this wrapper supplies the numbered
 * frame the For You surface reads as a magazine running order.
 */

/** Two-digit issue number from a zero-based index: 0 -> "01", 9 -> "10". */
export function sectionNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

interface NumberedSectionProps {
  /** The marker shown in the gutter, e.g. "01" or a "★" for Similar Titles. */
  readonly marker: string;
  /** Right-aligned aside, e.g. a friend stack or a "Source: TMDB" tag. */
  readonly aside?: React.ReactNode;
  readonly className?: string;
  readonly children: React.ReactNode;
}

export function NumberedSection({ marker, aside, className, children }: NumberedSectionProps) {
  return (
    <section className={cn("relative", className)}>
      <div className="mb-4 flex items-start justify-between gap-4 border-t border-[var(--border-strong)] pt-4">
        <span className="font-display text-2xl leading-none text-[var(--fg-dim)] tabular-nums">
          {marker}
        </span>
        {aside !== undefined && <div className="flex flex-shrink-0 items-center">{aside}</div>}
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
