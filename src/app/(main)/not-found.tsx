import { NotFoundContent } from "@/components/not-found-content";

/**
 * 404 for misses *inside* the authenticated app (an unknown sub-path, or a page
 * that called `notFound()` for a stale id). Rendered within `(main)/layout.tsx`,
 * so the sidebar shell — and the AblyProvider tree — stay mounted instead of
 * being torn down, which avoids the navigation-time teardown race a top-level
 * miss used to cause.
 */
export default function MainNotFound() {
  return <NotFoundContent homeHref="/home" homeLabel="Back to the dashboard" />;
}
