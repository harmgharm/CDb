/**
 * SWR hooks for media data
 */

import { useCallback, useState } from "react";
import useSWR from "swr";

import type { ApiResponse } from "@/lib/api/response";
import type { MediaSearchResult } from "@/types/media";
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
  return useSWR<MediaListResponse>(`/api/media?${queryString}`);
}

export function useMediaDetail(id: string | null) {
  return useSWR<MediaDetail>(id === null ? null : `/api/media/${id}`);
}

export function useMediaSearch() {
  const [results, setResults] = useState<MediaSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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

      const response = await fetch(`/api/media/search?${params.toString()}`);
      const json = (await response.json()) as ApiResponse<MediaSearchResult[]>;

      if (json.error === null) {
        setResults(json.data);
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
  }, []);

  return { results, isSearching, searchError, search, clearResults };
}

export function useMediaImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const importMedia = useCallback(
    async (params: { type: string; tmdbId?: number; malId?: number }) => {
      setIsImporting(true);
      setImportError(null);

      try {
        const response = await fetch("/api/media/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const json = (await response.json()) as ApiResponse<unknown>;

        if (json.error !== null) {
          setImportError(json.error);
          return false;
        }

        return true;
      } catch {
        setImportError("Import failed. Please try again.");
        return false;
      } finally {
        setIsImporting(false);
      }
    },
    [],
  );

  return { isImporting, importError, importMedia };
}
