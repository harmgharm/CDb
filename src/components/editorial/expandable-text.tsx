"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface ExpandableTextProps {
  /** The text to show. */
  readonly children: string;
  /** Extra classes for the text element (color, size, italic, etc.). */
  readonly className?: string;
}

/**
 * Text that clamps to two lines and expands to full on tap/click.
 *
 * Tap (not hover) so it works on touch devices, where the app's reviews and
 * session notes are read. The expand affordance only appears when the text
 * actually overflows the clamp — short text renders as plain, non-interactive
 * text. `break-words` keeps a long unbroken token (a pasted URL) from
 * overflowing its container in either state.
 */
export function ExpandableText({ children, className }: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Measure whether the clamped text is actually truncated, before paint so the
  // toggle never flickers in for fitting text. The element is line-clamped while
  // collapsed, so scrollHeight > clientHeight means there is hidden overflow.
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null || expanded) {
      return;
    }
    setOverflows(element.scrollHeight > element.clientHeight + 1);
  }, [children, expanded]);

  const toggle = useCallback(() => {
    setExpanded((previous) => !previous);
  }, []);

  return (
    <span
      ref={ref}
      // Interactive only when there is hidden overflow to reveal: short text
      // gets no pointer cursor, no tab stop, no toggle.
      role={overflows ? "button" : undefined}
      tabIndex={overflows ? 0 : undefined}
      aria-expanded={overflows ? expanded : undefined}
      onClick={overflows ? toggle : undefined}
      onKeyDown={
        overflows
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggle();
              }
            }
          : undefined
      }
      className={cn(
        "block break-words whitespace-pre-line",
        expanded ? undefined : "line-clamp-2",
        overflows && "hover:text-foreground/80 cursor-pointer transition-colors",
        className,
      )}
    >
      {children}
    </span>
  );
}
