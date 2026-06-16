/**
 * SWR hooks for media data
 */

import { useCallback, useState } from "react";
import useSWR from "swr";

import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";
import type { MediaPreviewDetail, MediaSearchResult } from "@/types/media";
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

export function useMediaSearch() {
  const [results, setResults] = useState<MediaSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [existingMediaMap, setExistingMediaMap] = useState<Map<string, string>>(new Map());

  const search = useCallback(async (query: string, type?: string) => {
    if (query.trim().length === 0) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const params = new URLSearchParams({ query });
      if (type !== undefined && type.length > 0) {
        params.set("type", type);
      }

      const response = await fetchWithAuth(`/api/media/search?${params.toString()}`);
      const json = (await response.json()) as ApiResponse<MediaSearchResult[]>;

      if (json.error === null) {
        // Deduplicate by source + externalId (Jikan can return duplicates)
        const seen = new Set<string>();
        const unique = json.data.filter((item) => {
          const key = `${item.source}-${String(item.externalId)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setResults(unique);

        // Build map of already-imported media from API response
        const existing = new Map<string, string>();
        for (const item of unique) {
          if (item.existingMediaId !== undefined) {
            const key = `${item.source}-${String(item.externalId)}`;
            existing.set(key, item.existingMediaId);
          }
        }
        setExistingMediaMap(existing);
      } else {
        setSearchError(json.error);
        setResults([]);
      }
    } catch {
      setSearchError("Search failed. Please try again.");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setSearchError(null);
    setExistingMediaMap(new Map());
  }, []);

  return { results, isSearching, searchError, search, clearResults, existingMediaMap };
}

interface ImportedMedia {
  id: string;
  title: string;
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
