import { useCallback, useEffect, useRef } from "react";

/**
 * Manages a setTimeout-based auto-submit timer as a fallback for rAF-based visual timers.
 *
 * Browsers pause requestAnimationFrame in hidden/background tabs, so the visual timer's
 * onTimeExpired callback won't fire. This hook provides:
 * 1. A setTimeout that fires after `roundTimerMs` regardless of tab visibility
 * 2. A visibilitychange listener that catches up when the tab becomes visible
 * 3. A stable ref for the latest onTimeExpired callback (avoids stale closures)
 */
export function useAutoSubmitTimer(
  roundTimerMs: number,
  startTimeForRound: number,
  mutate: () => Promise<unknown>,
) {
  const autoSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTimeExpiredRef = useRef<(() => void) | null>(null);

  /** Update the callback ref. Call this after defining handleTimeExpired in the component. */
  const setOnTimeExpired = useCallback((callback: () => void) => {
    handleTimeExpiredRef.current = callback;
  }, []);

  /** Start a setTimeout backup for auto-submit. */
  const startAutoSubmitTimer = useCallback(() => {
    if (autoSubmitTimerRef.current !== null) {
      clearTimeout(autoSubmitTimerRef.current);
    }
    autoSubmitTimerRef.current = setTimeout(() => {
      autoSubmitTimerRef.current = null;
      handleTimeExpiredRef.current?.();
    }, roundTimerMs);
  }, [roundTimerMs]);

  /** Clear the auto-submit timer (call from clearFallbackTimers). */
  const clearAutoSubmitTimer = useCallback(() => {
    if (autoSubmitTimerRef.current !== null) {
      clearTimeout(autoSubmitTimerRef.current);
      autoSubmitTimerRef.current = null;
    }
  }, []);

  // When the tab becomes visible, catch up: re-fetch game state and auto-submit if timer expired.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      void mutate();
      const elapsed = Date.now() - startTimeForRound;
      if (elapsed >= roundTimerMs) {
        handleTimeExpiredRef.current?.();
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [startTimeForRound, mutate, roundTimerMs]);

  // Clean up auto-submit timer on unmount
  useEffect(() => {
    return () => {
      if (autoSubmitTimerRef.current !== null) {
        clearTimeout(autoSubmitTimerRef.current);
      }
    };
  }, []);

  return { setOnTimeExpired, startAutoSubmitTimer, clearAutoSubmitTimer };
}
