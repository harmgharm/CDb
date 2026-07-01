"use client";

import * as motion from "motion/react-client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * Magazine cover header: a full-bleed editorial profile lockup. The roster
 * position sits in big amber italic on the side, then the avatar (with a live
 * online pill) beside a large serif name, italic tagline, and meta row.
 *
 * Introduced on the user profile (Phase 8). The atmospheric wash behind it is a
 * separate <MagazineCoverBackdrop> the page renders as the first child of its
 * wrapper, so the wash sits behind ALL page content (header, stat cards, tabs),
 * not just the cover. The page wrapper needs `relative` and `overflow-x: clip`
 * because the blurred backdrop bleeds a few px horizontally.
 */

/**
 * Full-bleed atmospheric wash: a blurred avatar, a scrim fading to the page
 * background, and film grain. Render it once as the first child of the profile
 * page wrapper (which must be `relative` with `overflow-x: clip`). It is
 * `absolute` and behind everything, so later siblings paint on top of it.
 */
export function MagazineCoverBackdrop({ avatarUrl }: Readonly<{ avatarUrl?: string | null }>) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[480px] overflow-hidden">
      {avatarUrl !== null && avatarUrl !== undefined && avatarUrl.length > 0 ? (
        <div
          className="absolute inset-0 scale-125 bg-cover bg-center opacity-45 blur-[80px] saturate-[0.8]"
          style={{ backgroundImage: `url(${JSON.stringify(avatarUrl)})` }}
        />
      ) : (
        <div className="bg-cdb-marquee/20 absolute inset-0 opacity-45 blur-[80px]" />
      )}
      <div className="from-background/50 via-background/85 to-background absolute inset-0 bg-gradient-to-b" />
      {/* Warm "magazine cover" wash: the kit's scrim sits over a browner near-black
          (rgba(15,11,10)) than our neutral --bg. A faint amber overlay, strongest at
          the top and fading out downward, recovers that warmth while staying on-token
          (light mode safe). */}
      <div className="absolute inset-0 bg-gradient-to-b from-[color-mix(in_oklch,var(--cdb-marquee)_9%,transparent)] to-transparent" />
      <div className="cdb-grain" style={{ "--cdb-grain-opacity": "0.15" } as React.CSSProperties} />
    </div>
  );
}

interface MagazineCoverHeaderProps {
  /** Display-only roster position, rendered zero-padded ("03"). */
  readonly rosterNumber: number | null;
  /** Mono micro-credit, e.g. "Member since Aug 2024". */
  readonly credit: string;
  /** Large serif name (display name or username). */
  readonly name: string;
  /** Italic amber tagline. Omitted entirely when null or blank. */
  readonly tagline?: string | null;
  /** Handle, e.g. "@username". */
  readonly handle: string;
  /** Mono meta fragments joined with · separators, e.g. ["12 picks", "47 watched"]. */
  readonly metaItems: readonly string[];
  readonly avatarUrl?: string | null;
  /** Initials shown when the avatar image is missing. */
  readonly avatarFallback: string;
  /**
   * Optional presence pill rendered over the avatar (e.g. <OnlineNowPill />).
   * Passed as a slot so the live-presence read stays in a small gated leaf and
   * never remounts this header. Omit when the member is offline.
   */
  readonly onlinePill?: React.ReactNode;
  /** Optional role badge (Admin / Mod), passed in so the primitive stays role-agnostic. */
  readonly roleBadge?: React.ReactNode;
}

function hasText(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && value.trim().length > 0;
}

/** The "Online now" pill that sits under the cover avatar. Render via the header's `onlinePill` slot. */
export function OnlineNowPill() {
  return (
    <div className="bg-card text-cdb-success absolute -bottom-2.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-2.5 py-1 text-[10px] font-medium whitespace-nowrap">
      <span className="bg-cdb-success animate-up-next-pulse size-1.5 rounded-full" />
      Online now
    </div>
  );
}

export function MagazineCoverHeader({
  rosterNumber,
  credit,
  name,
  tagline,
  handle,
  metaItems,
  avatarUrl,
  avatarFallback,
  onlinePill,
  roleBadge,
}: MagazineCoverHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
      className="relative z-10 grid grid-cols-1 items-end gap-8 border-b border-[var(--border-strong)] pb-6 sm:grid-cols-[120px_1fr] sm:gap-10"
    >
      <div className="flex flex-col gap-2 sm:items-end sm:text-right">
        {rosterNumber !== null && (
          <div className="font-display text-cdb-marquee text-5xl leading-none font-normal tracking-[-0.04em] italic sm:text-6xl">
            {String(rosterNumber).padStart(2, "0")}
          </div>
        )}
        <div className="text-muted-foreground font-mono text-[10px] tracking-[0.14em] uppercase">
          {credit}
        </div>
      </div>

      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:gap-7">
        <div className="relative size-28 shrink-0 sm:size-32">
          <Avatar className="size-full border-3 shadow-xl">
            <AvatarImage src={avatarUrl ?? undefined} alt={name} />
            <AvatarFallback className="text-3xl">{avatarFallback}</AvatarFallback>
          </Avatar>
          {onlinePill}
        </div>

        <div className="flex min-w-0 flex-col gap-2 pb-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display m-0 text-[clamp(48px,9vw,88px)] leading-[0.95] font-normal tracking-[-0.035em]">
              {name}
            </h1>
            {roleBadge}
          </div>
          {hasText(tagline) && (
            <p className="font-display text-cdb-marquee-text m-0 text-xl italic">
              &ldquo;{tagline}&rdquo;
            </p>
          )}
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 font-mono text-xs tracking-[0.04em]">
            <span>{handle}</span>
            {metaItems.map((item) => (
              <span key={item} className="flex items-center gap-2">
                <span aria-hidden="true" className="text-[var(--fg-dim)]">
                  ·
                </span>
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
