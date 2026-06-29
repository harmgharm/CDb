"use client";

import { ArrowDownIcon, ArrowUpIcon, SearchIcon } from "lucide-react";
import { Fragment } from "react";

import { cn } from "@/lib/utils";

/**
 * Conversational filter sentence: filter controls rendered as a readable line
 * of italic serif words instead of a row of selects. Each selectable word is a
 * real focusable <button> with an aria-label.
 *
 * Introduced on Database (Phase 6) and reused on For You (Phase 7) with
 * different segments (type/sort here, type/genre/decade there). The component
 * owns presentation only; all filter state lives in the page. It is generic
 * over the segments it renders so a second consumer can pass its own options
 * without changing this file.
 *
 * Two segment modes:
 * - "toggle": every option renders as a word; clicking selects it. Single-pick
 *   by default (Database's type filter); pass `multiple` with `activeValues`
 *   for an additive multi-select (For You's type/genre/decade filters).
 * - "cycle": only the active word renders; clicking advances to the next
 *   option and wraps. Keeps a long option list to a single word in the
 *   sentence.
 */

export interface FilterOption {
  readonly value: string;
  /** The word shown in the sentence, e.g. "movies". */
  readonly word: string;
  /** Full accessible label, e.g. "Show movies only". */
  readonly ariaLabel: string;
}

export interface FilterSegment {
  /** Stable key for React. */
  readonly key: string;
  /** Optional lead-in rendered before the word(s), e.g. "sorted by". */
  readonly label?: string;
  readonly options: readonly FilterOption[];
  /**
   * The single active value. Used by "cycle" mode and by single-select
   * "toggle" mode. Ignored when `multiple` is set, where `activeValues` drives
   * the active state instead.
   */
  readonly activeValue: string;
  readonly mode: "toggle" | "cycle";
  readonly onSelect: (value: string) => void;
  /**
   * Multi-select toggle: more than one option can be active at once. The page
   * owns add/remove (e.g. via a Set), so `onSelect` here means "this word was
   * clicked", not "this is now the only selection". Only meaningful for
   * "toggle" mode.
   */
  readonly multiple?: boolean;
  /** Active values when `multiple` is set. Ignored otherwise. */
  readonly activeValues?: readonly string[];
}

interface DirectionToggle {
  readonly value: "asc" | "desc";
  readonly onToggle: () => void;
  readonly ariaLabel: string;
}

interface SearchControl {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
}

interface ConversationalFiltersProps {
  /** Sentence opener, e.g. "The full archive". */
  readonly lead: string;
  readonly segments: readonly FilterSegment[];
  /** Optional asc/desc toggle rendered after the last segment. */
  readonly direction?: DirectionToggle;
  /**
   * Optional search box rendered in the right-hand band. Database filters by
   * title; For You has no search, so the box is omitted there.
   */
  readonly search?: SearchControl;
  /**
   * Page-specific controls rendered at the right of the band, after the search
   * (e.g. view toggle, refresh, add). Kept as a slot so the primitive owns the
   * layout while each consumer supplies its own actions.
   */
  readonly actions?: React.ReactNode;
}

const WORD_BASE =
  "font-display cursor-pointer rounded-sm text-[20px] leading-none italic underline decoration-[color-mix(in_oklch,var(--cdb-marquee)_30%,transparent)] decoration-1 underline-offset-4 transition-colors outline-none hover:text-cdb-marquee hover:decoration-[var(--cdb-marquee)] focus-visible:ring-2 focus-visible:ring-[var(--cdb-marquee)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]";

function FilterWord({
  option,
  active,
  onClick,
}: Readonly<{ option: FilterOption; active: boolean; onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={option.ariaLabel}
      className={cn(
        WORD_BASE,
        active
          ? "text-cdb-marquee decoration-[var(--cdb-marquee)]"
          : "text-foreground decoration-[color-mix(in_oklch,var(--cdb-marquee)_30%,transparent)]",
      )}
    >
      {option.word}
    </button>
  );
}

function ToggleSegment({ segment }: Readonly<{ segment: FilterSegment }>) {
  const activeValues = segment.activeValues ?? [];
  const isActive = (value: string): boolean =>
    segment.multiple === true ? activeValues.includes(value) : segment.activeValue === value;

  return (
    <>
      {segment.options.map((option, index) => (
        <Fragment key={option.value}>
          {index > 0 && <span className="text-muted-foreground italic">,</span>}
          <FilterWord
            option={option}
            active={isActive(option.value)}
            onClick={() => {
              segment.onSelect(option.value);
            }}
          />
        </Fragment>
      ))}
    </>
  );
}

function CycleSegment({ segment }: Readonly<{ segment: FilterSegment }>) {
  const activeIndex = segment.options.findIndex((o) => o.value === segment.activeValue);
  const current = segment.options[activeIndex] ?? segment.options[0];
  if (current === undefined) return null;

  const next = segment.options[(activeIndex + 1) % segment.options.length] ?? current;

  return (
    <button
      type="button"
      onClick={() => {
        segment.onSelect(next.value);
      }}
      aria-label={`Sorted by ${current.word}. Activate to sort by ${next.word}.`}
      className={cn(WORD_BASE, "text-cdb-marquee decoration-[var(--cdb-marquee)]")}
    >
      {current.word}
    </button>
  );
}

export function ConversationalFilters({
  lead,
  segments,
  direction,
  search,
  actions,
}: ConversationalFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-y border-[var(--border-strong)] py-4">
      <p className="font-display text-muted-foreground flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 text-[20px] leading-none italic">
        <span>{lead},</span>
        {segments.map((segment, index) => (
          <Fragment key={segment.key}>
            {index > 0 && <span>,</span>}
            {segment.label !== undefined && <span>{segment.label}</span>}
            {segment.mode === "toggle" ? (
              <ToggleSegment segment={segment} />
            ) : (
              <CycleSegment segment={segment} />
            )}
          </Fragment>
        ))}
        {direction !== undefined && (
          <button
            type="button"
            onClick={direction.onToggle}
            aria-label={direction.ariaLabel}
            className="text-muted-foreground hover:text-cdb-marquee focus-visible:ring-cdb-marquee inline-flex size-6 items-center justify-center rounded-sm outline-none focus-visible:ring-2"
          >
            {direction.value === "desc" ? (
              <ArrowDownIcon className="size-4" />
            ) : (
              <ArrowUpIcon className="size-4" />
            )}
          </button>
        )}
        <span>.</span>
      </p>

      <div className="flex w-full max-w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-shrink-0">
        {search !== undefined && (
          <div className="relative w-full sm:w-48">
            <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--fg-dim)]" />
            <input
              type="search"
              value={search.value}
              placeholder={search.placeholder ?? "Search titles..."}
              onChange={(event) => {
                search.onChange(event.target.value);
              }}
              className="bg-card focus-visible:border-cdb-marquee focus-visible:ring-cdb-marquee h-9 w-full rounded-md border pr-3 pl-9 text-sm outline-none focus-visible:ring-1"
            />
          </div>
        )}
        {actions}
      </div>
    </div>
  );
}
