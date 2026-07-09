/**
 * GET /api/stats/featured — Featured media for the Database editorial band.
 *
 * Returns the group's top-rated title this month (plus a short supporting
 * stack), ranked by average rating. When the current month has no qualifying
 * ratings yet, falls back to the all-time ranking and reports `scope` so the
 * UI can label the band honestly ("highest rated this month" vs "highest
 * rated").
 */

import { successResponse } from "@/lib/api/response";
import { withAuth } from "@/lib/api/with-auth";
import {
  attachFeaturedLineage,
  fetchFeaturedLineage,
  fetchFeaturedMedia,
  formatFeaturedMedia,
} from "@/lib/stats/featured";
import type { FeaturedResponse } from "@/types/detailed-stats";

// 1 headline + 3 supporting cards.
const FEATURED_LIMIT = 4;

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export const GET = withAuth(async () => {
  const monthRows = await fetchFeaturedMedia(FEATURED_LIMIT, startOfCurrentMonth());

  const rows = monthRows.length > 0 ? monthRows : await fetchFeaturedMedia(FEATURED_LIMIT);
  const scope: FeaturedResponse["scope"] = monthRows.length > 0 ? "month" : "all-time";

  const formatted = formatFeaturedMedia(rows);

  // Enrich with the queue's picker/attendee lineage (the kit's "Picked by" line
  // + attendee stack). Only the headline card renders it, but attaching to all
  // rows keeps the formatter and the lineage merge uniform.
  const lineage = await fetchFeaturedLineage(formatted.map((m) => m.id));
  const enriched = attachFeaturedLineage(formatted, lineage);

  const result: FeaturedResponse = {
    scope,
    main: enriched[0] ?? null,
    supporting: enriched.slice(1),
  };

  return successResponse(result);
});
