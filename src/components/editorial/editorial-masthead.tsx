import { cn } from "@/lib/utils";

/**
 * Editorial masthead: an eyebrow + issue line over a rule, a large serif title
 * with a single italic amber accent word, and an optional italic lede.
 *
 * First introduced on the Database surface (Phase 6) and reused on For You
 * (Phase 7). The API is deliberately minimal: the only structural variables are
 * the title's lead/accent split, the eyebrow/issue strings, the lede,
 * alignment, the divider position, and an optional actions slot. Anything more
 * elaborate should be added when a real second consumer needs it, not
 * preemptively.
 *
 * Two divider modes match the two kit headers:
 *   - `divider="top"` (Database / not-found): the eyebrow + issue line sit in a
 *     ruled block, with the rule UNDER them and above the title.
 *   - `divider="bottom"` (For You): the eyebrow, title, and lede are one
 *     centered block with a single rule at the BOTTOM of the whole header. The
 *     eyebrow has no rule of its own. Matches the kit's `.cdb-fy-header`.
 */

interface EditorialMastheadProps {
  /** Left side of the issue line, e.g. "CDb · Issue #14". */
  readonly eyebrow: string;
  /** Right side of the issue line, e.g. "May · MMXXVI". Omit to hide. */
  readonly issueLine?: string;
  /** Non-accented lead of the title, e.g. "The". */
  readonly titleLead: string;
  /** The italic amber accent word, e.g. "collection". */
  readonly titleAccent: string;
  /** Italic lede paragraph below the title. Omit to hide. */
  readonly lede?: string;
  /**
   * Quiet stat line below the lede, e.g. "73 titles · 23 weeks in". Kept
   * separate from the lede so async counts pop in additively instead of
   * reflowing the lede. Omit while the data is loading.
   */
  readonly footnote?: string;
  /** Title/lede alignment. Database centers; other surfaces may left-align. */
  readonly align?: "center" | "left";
  /**
   * Where the dividing rule sits. `top` (default) rules the eyebrow block, above
   * the title (Database / not-found). `bottom` rules the whole header at its
   * base and leaves the eyebrow unruled (For You). See the kit note above.
   */
  readonly divider?: "top" | "bottom";
  /**
   * Optional controls rendered to the right of the title (For You puts its
   * Dismissed / Refresh all buttons here). On a left-aligned masthead they sit
   * in a row beside the title; on a centered masthead (For You) they float
   * top-right so the centered title stays centered, matching the kit's
   * absolutely-positioned `.cdb-fy-actions`.
   */
  readonly actions?: React.ReactNode;
}

export function EditorialMasthead({
  eyebrow,
  issueLine,
  titleLead,
  titleAccent,
  lede,
  footnote,
  align = "center",
  divider = "top",
  actions,
}: EditorialMastheadProps) {
  const isCentered = align === "center";
  const dividerBottom = divider === "bottom";
  // Left-aligned mastheads put actions in a row beside the title; centered ones
  // float them top-right so the title stays optically centered.
  const showInlineActions = !isCentered && actions !== undefined;
  const showFloatingActions = isCentered && actions !== undefined;

  return (
    <header
      className={cn(
        "relative flex flex-col gap-6",
        dividerBottom && "border-b border-[var(--border-strong)] pb-6",
      )}
    >
      {showFloatingActions && (
        // Float top-right on wider screens so the centered title stays centered;
        // below the drawer breakpoint (900px) drop into normal flow at the top
        // so the buttons can't overlap the eyebrow/title. Mirrors the kit's
        // `.cdb-fy-actions` going `position: static` under its 900px media query.
        <div className="z-10 flex flex-shrink-0 items-center gap-2 min-[900px]:absolute min-[900px]:top-0 min-[900px]:right-0">
          {actions}
        </div>
      )}

      <div
        className={cn(
          "flex items-baseline justify-between",
          // `top` divider rules the eyebrow block; `bottom` leaves it unruled
          // (the rule lives on <header> instead).
          !dividerBottom && "border-b border-[var(--border-strong)] pb-3",
        )}
      >
        <span className="text-muted-foreground font-mono text-[11px] font-semibold tracking-[0.16em] uppercase">
          {eyebrow}
        </span>
        {issueLine !== undefined && (
          <span className="text-muted-foreground font-mono text-[11px] font-semibold tracking-[0.16em] uppercase">
            {issueLine}
          </span>
        )}
      </div>

      {showInlineActions ? (
        <div className="flex items-start justify-between gap-6">
          <h1 className="font-display m-0 text-left text-[clamp(56px,11vw,144px)] leading-[0.88] font-normal tracking-[-0.045em]">
            <span className="text-[var(--fg-dim)]">{titleLead}</span>{" "}
            <em className="text-cdb-marquee-text tracking-[-0.06em] italic">{titleAccent}</em>
          </h1>
          <div className="flex flex-shrink-0 items-center gap-2 pt-2">{actions}</div>
        </div>
      ) : (
        <h1
          className={cn(
            "font-display m-0 text-[clamp(56px,11vw,144px)] leading-[0.88] font-normal tracking-[-0.045em]",
            isCentered ? "text-center" : "text-left",
          )}
        >
          <span className="text-[var(--fg-dim)]">{titleLead}</span>{" "}
          <em className="text-cdb-marquee-text tracking-[-0.06em] italic">{titleAccent}</em>
        </h1>
      )}

      {lede !== undefined && (
        <p
          className={cn(
            "font-display text-muted-foreground text-lg leading-[1.4] italic",
            isCentered ? "mx-auto max-w-[540px] text-center" : "max-w-[540px] text-left",
          )}
        >
          {lede}
        </p>
      )}

      {footnote !== undefined && (
        <p
          className={cn(
            // Styled like the lede (serif, italic, muted) so it reads as a
            // continuation line, but kept a separate element so the async count
            // pops in without reflowing the lede. -mt offsets the header gap so
            // it sits just under the lede rather than as a detached block.
            "font-display text-muted-foreground -mt-5 text-lg leading-[1.4] italic",
            isCentered ? "mx-auto max-w-[540px] text-center" : "max-w-[540px] text-left",
          )}
        >
          {footnote}
        </p>
      )}
    </header>
  );
}
