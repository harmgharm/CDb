/**
 * Debounces a search term: the raw value updates immediately (so the input
 * stays responsive) while the debounced value trails by `delayMs`. Non-search
 * filter changes that call `flush` apply instantly without waiting.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export function useDebouncedSearch(delayMs = 400) {
  const [debounced, setDebounced] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const clear = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  // Schedule a debounced update for a non-empty term; apply an empty term (a
  // cleared search) immediately so results snap back without a delay.
  const schedule = useCallback(
    (value: string) => {
      clear();
      if (value.length === 0) {
        setDebounced("");
      } else {
        timerRef.current = setTimeout(() => {
          setDebounced(value);
        }, delayMs);
      }
    },
    [clear, delayMs],
  );

  useEffect(() => clear, [clear]);

  return { debounced, schedule };
}
