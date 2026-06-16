/**
 * SWR hook for the Database "Featured" editorial band.
 */

import useSWR from "swr";

import type { FeaturedResponse } from "@/types/detailed-stats";

export function useFeatured() {
  return useSWR<FeaturedResponse>("/api/stats/featured");
}
