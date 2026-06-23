import Link from "next/link";

import { EditorialMasthead } from "@/components/editorial/editorial-masthead";
import { Button } from "@/components/ui/button";

/**
 * The editorial body of a 404 page, shared by the root `not-found.tsx` (stray
 * top-level paths) and the `(main)/not-found.tsx` (misses inside the app shell).
 * The destination is a prop so each context links somewhere sensible — the app
 * shell back to `/home`, the standalone page back to the landing `/`.
 */
export function NotFoundContent({
  homeHref,
  homeLabel,
}: Readonly<{ homeHref: string; homeLabel: string }>) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 py-16 text-center">
      <EditorialMasthead
        eyebrow="CDb · Error 404"
        issueLine="Off the map"
        titleLead="Page"
        titleAccent="not found"
        lede="We couldn't find that page. It may have moved, been removed, or never existed."
      />
      <Button asChild variant="outline">
        <Link href={homeHref}>{homeLabel}</Link>
      </Button>
    </div>
  );
}
