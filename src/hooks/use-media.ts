/**
 * SWR hooks for media data
 */

import { useCallback, useRef, useState } from "react";
import useSWR from "swr";

import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";
import type { MediaType } from "@/lib/db/types";
import type { MediaPreviewDetail, MediaSearchResponse, MediaSearchResult } from "@/types/media";
import type { MediaDetail, MediaListResponse } from "@/types/media-responses";

interface MediaQueryParams {
  type?: string;
  genre?: string;
  yearFrom?: string;
  yearTo?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
}

function buildQueryString(params: MediaQueryParams): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && String(value).length > 0) {
      searchParams.set(key, String(value));
    }
  }
  return searchParams.toString();
}

export function useMediaList(params: MediaQueryParams) {
  const queryString = buildQueryString(params);
  // keepPreviousData holds the last result while a filter/sort change refetches,
  // so the title count and grid update smoothly instead of blanking to undefined
  // (and flashing a skeleton) on every filter click.
  return useSWR<MediaListResponse>(`/api/media?${queryString}`, {
    keepPreviousData: true,
  });
}

export function useMediaDetail(id: string | null) {
  return useSWR<MediaDetail>(id === null ? null : `/api/media/${id}`);
}

/** Drop duplicate hits keyed by source + externalId (Jikan can repeat). */
function dedupeResults(items: MediaSearchResult[]): MediaSearchResult[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.source}-${String(item.externalId)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Map source+externalId → existing media id for already-imported results. */
function buildExistingMediaMap(items: MediaSearchResult[]): Map<string, string> {
  const existing = new Map<string, string>();
  for (const item of items) {
    if (item.existingMediaId !== undefined) {
      existing.set(`${item.source}-${String(item.externalId)}`, item.existingMediaId);
    }
  }
  return existing;
}

export function useMediaSearch() {
  const [results, setResults] = useState<MediaSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [failedSources, setFailedSources] = useState<MediaType[]>([]);
  const [existingMediaMap, setExistingMediaMap] = useState<Map<string, string>>(new Map());
  // Monotonic request id. Each search() bumps it; a response only commits its
  // state if it's still the latest request, so a slow earlier search can't
  // overwrite a newer one's results/error (out-of-order responses on fast filter
  // switches).
  const requestIdRef = useRef(0);

  const search = useCallback(async (query: string, type?: string) => {
    if (query.trim().length === 0) {
      requestIdRef.current += 1;
      setResults([]);
      setFailedSources([]);
      return;
    }

    const requestId = (requestIdRef.current += 1);
    const isStale = () => requestIdRef.current !== requestId;

    setIsSearching(true);
    setSearchError(null);
    setFailedSources([]);

    try {
      const params = new URLSearchParams({ query });
      if (type !== undefined && type.length > 0) {
        params.set("type", type);
      }

      const response = await fetchWithAuth(`/api/media/search?${params.toString()}`);
      const json = (await response.json()) as ApiResponse<MediaSearchResponse>;
      if (isStale()) return;

      if (json.error === null) {
        const unique = dedupeResults(json.data.results);
        setResults(unique);
        setFailedSources(json.data.failedSources);
        setExistingMediaMap(buildExistingMediaMap(unique));

        // Total outage: every queried source failed, so there are no results to
        // show. Surface a blocking error (the red box) so the user can tell an
        // outage from a genuine "no matches" — and so non-dialog consumers
        // (find-similar, predictions) that only read searchError get the signal.
        // A PARTIAL failure always leaves at least one result, so it stays soft:
        // reported via failedSources for a filter-scoped notice, never here.
        if (unique.length === 0 && json.data.failedSources.length > 0) {
          setSearchError("Search is temporarily unavailable. Please try again.");
        }
      } else {
        setSearchError(json.error);
        setResults([]);
        setFailedSources([]);
      }
    } catch {
      if (isStale()) return;
      setSearchError("Search failed. Please try again.");
      setResults([]);
      setFailedSources([]);
    } finally {
      if (!isStale()) setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    requestIdRef.current += 1;
    setResults([]);
    setSearchError(null);
    setFailedSources([]);
    setExistingMediaMap(new Map());
  }, []);

  return {
    results,
    isSearching,
    searchError,
    failedSources,
    search,
    clearResults,
    existingMediaMap,
  };
}

interface ImportedMedia {
  id: string;
  title: string;
  /**
   * True when the title was already in the database and the existing row was
   * returned (the import endpoint no-ops a duplicate instead of erroring). Lets
   * callers skip the "freshly imported" UX (session-log form, "Imported" toast)
   * for a title that was already present.
   */
  alreadyExisted: boolean;
}

export function useMediaImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const importMedia = useCallback(
    async (params: {
      type: string;
      tmdbId?: number;
      malId?: number;
    }): Promise<ImportedMedia | null> => {
      setIsImporting(true);
      setImportError(null);

      try {
        const response = await fetchWithAuth("/api/media/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const json = (await response.json()) as ApiResponse<ImportedMedia>;

        if (json.error !== null) {
          setImportError(json.error);
          return null;
        }

        return json.data;
      } catch {
        setImportError("Import failed. Please try again.");
        return null;
      } finally {
        setIsImporting(false);
      }
    },
    [],
  );

  return { isImporting, importError, importMedia };
}

export function useMediaPreview(
  source: string | null,
  externalId: number | null,
  type: string | null,
) {
  const key =
    source !== null && externalId !== null && type !== null
      ? `/api/media/preview?source=${source}&externalId=${String(externalId)}&type=${type}`
      : null;

  return useSWR<MediaPreviewDetail>(key);
}
