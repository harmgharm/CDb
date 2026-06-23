/**
 * The user-profile page (`/users/[id]`) exposes its tabbed content via a `?tab=`
 * query param so a tab is deep-linkable and shareable. These helpers are the
 * single source of which tab values are valid and how an arbitrary param string
 * maps to one — kept pure (no React/router) so the validation is unit-testable.
 */

export const PROFILE_TABS = ["overview", "stats", "games", "watchlist"] as const;

export type ProfileTab = (typeof PROFILE_TABS)[number];

const DEFAULT_TAB: ProfileTab = "overview";

/** Whether an arbitrary string is one of the known profile tabs. */
export function isProfileTab(value: string): value is ProfileTab {
  return (PROFILE_TABS as readonly string[]).includes(value);
}

/**
 * Map a raw `?tab=` value (or `null` when absent) to a valid profile tab,
 * falling back to the default for anything unrecognized so a junk URL can't
 * leave the tabs with no active value.
 */
export function resolveProfileTab(value: string | null): ProfileTab {
  return value !== null && isProfileTab(value) ? value : DEFAULT_TAB;
}
