/**
 * Persisted Database view toggle (grid / list / timeline), backed by
 * localStorage under the kit's `cdb:db-view` key.
 *
 * Uses useSyncExternalStore so the server snapshot is always the default
 * ("grid") while the client reads the stored value — no hydration mismatch and
 * no setState-in-effect. The view is a personal preference, so last-used wins
 * across visits.
 */

import { useCallback, useSyncExternalStore } from "react";

export type DatabaseView = "grid" | "list" | "timeline";

const STORAGE_KEY = "cdb:db-view";
const DEFAULT_VIEW: DatabaseView = "grid";

function isView(value: string | null): value is DatabaseView {
  return value === "grid" || value === "list" || value === "timeline";
}

function readView(): DatabaseView {
  try {
    const stored = globalThis.localStorage.getItem(STORAGE_KEY);
    return isView(stored) ? stored : DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}

function subscribe(onChange: () => void): () => void {
  // `storage` fires for changes from other tabs; our own writes dispatch a
  // synthetic event (below) so this tab re-renders too.
  globalThis.addEventListener("storage", onChange);
  return () => {
    globalThis.removeEventListener("storage", onChange);
  };
}

export function useStoredView(): readonly [DatabaseView, (next: DatabaseView) => void] {
  const view = useSyncExternalStore(subscribe, readView, () => DEFAULT_VIEW);

  const setView = useCallback((next: DatabaseView) => {
    try {
      globalThis.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode / quota): the view won't persist
      // across visits, but the synthetic event below still re-renders this tab.
    }
    // Notify our own subscriber — `storage` only fires cross-tab natively.
    globalThis.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  return [view, setView] as const;
}
