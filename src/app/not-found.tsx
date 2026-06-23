import { Wordmark } from "@/components/branding/wordmark";
import { NotFoundContent } from "@/components/not-found-content";

/**
 * Root 404 for stray top-level paths (anything matching no route group — e.g. a
 * mistyped URL, or a dead link like the former `/watchlist`). Renders inside the
 * root layout only, *outside* the app shell, so it frames itself: a wordmark
 * over the shared editorial body. Links to the landing `/`, since a top-level
 * miss can come from a logged-out visitor.
 */
export default function NotFound() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <Wordmark size="md" asLink className="mb-4" />
      <NotFoundContent homeHref="/" homeLabel="Back to the start" />
    </div>
  );
}
