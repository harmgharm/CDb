import * as React from "react";

// 900, not the Tailwind md=768 boundary: this constant only decides rail vs.
// drawer for the sidebar (its sole consumer). The 256px rail plus the content
// column's ~623px min-width total ~879px, so below ~900px the rail and content
// cannot both fit and the page scrolls horizontally. Switching to the drawer at
// <900px keeps the content full-width in the 768-899 band (Phase 11 mobile pass).
const MOBILE_BREAKPOINT = 900;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>();

  React.useEffect(() => {
    const mql = globalThis.matchMedia(`(max-width: ${String(MOBILE_BREAKPOINT - 1)}px)`);
    const onChange = () => {
      setIsMobile(globalThis.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(globalThis.innerWidth < MOBILE_BREAKPOINT);
    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, []);

  return isMobile === true;
}
