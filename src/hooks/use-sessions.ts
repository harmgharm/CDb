/**
 * Hooks for session and rating mutations
 */

import { useCallback, useMemo, useState } from "react";
import useSWRInfinite from "swr/infinite";

import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";
import type { TimelineEntry, TimelinePayload } from "@/types/timeline-responses";

interface InlineRating {
  readonly userId: string;
  readonly score: number;
}

interface CreateSessionParams {
  readonly mediaId: string;
  readonly dateWatched?: string;
  readonly timeWatchedAt?: string;
  readonly pickedByUserId?: string | null;
  readonly attendeeIds: string[];
  readonly notes?: string;
  readonly ratings?: InlineRating[];
}

export function useCreateSession() {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(async (params: CreateSessionParams): Promise<boolean> => {
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetchWithAuth("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const json = (await response.json()) as ApiResponse<unknown>;
      if (json.error !== null) {
        setError(json.error);
        return false;
      }
      return true;
    } catch {
      setError("Failed to create session");
      return false;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return { createSession, isCreating, error };
}

interface SubmitRatingParams {
  readonly sessionId: string;
  readonly score: number;
  readonly review?: string;
  readonly userId?: string;
}

export function useSubmitRating() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitRating = useCallback(async (params: SubmitRatingParams): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetchWithAuth("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const json = (await response.json()) as ApiResponse<unknown>;
      if (json.error !== null) {
        setError(json.error);
        return false;
      }
      return true;
    } catch {
      setError("Failed to submit rating");
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { submitRating, isSubmitting, error };
}

interface UpdateSessionParams {
  readonly dateWatched?: string | null;
  readonly timeWatchedAt?: string | null;
  readonly pickedByUserId?: string | null;
  readonly notes?: string | null;
}

export function useUpdateSession() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateSession = useCallback(
    async (sessionId: string, params: UpdateSessionParams): Promise<boolean> => {
      setIsUpdating(true);
      setError(null);
      try {
        const response = await fetchWithAuth(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const json = (await response.json()) as ApiResponse<unknown>;
        if (json.error !== null) {
          setError(json.error);
          return false;
        }
        return true;
      } catch {
        setError("Failed to update session");
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [],
  );

  return { updateSession, isUpdating, error };
}

export function useDeleteMedia() {
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteMedia = useCallback(async (mediaId: string): Promise<boolean> => {
    setIsDeleting(true);
    try {
      const response = await fetchWithAuth(`/api/media/${mediaId}`, { method: "DELETE" });
      const json = (await response.json()) as ApiResponse<unknown>;
      return json.error === null;
    } catch {
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { deleteMedia, isDeleting };
}

export function useDeleteSession() {
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteSession = useCallback(async (sessionId: string): Promise<boolean> => {
    setIsDeleting(true);
    try {
      const response = await fetchWithAuth(`/api/sessions/${sessionId}`, { method: "DELETE" });
      const json = (await response.json()) as ApiResponse<unknown>;
      return json.error === null;
    } catch {
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { deleteSession, isDeleting };
}

export function useDeleteRating() {
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteRating = useCallback(async (ratingId: string): Promise<boolean> => {
    setIsDeleting(true);
    try {
      const response = await fetchWithAuth(`/api/ratings/${ratingId}`, { method: "DELETE" });
      const json = (await response.json()) as ApiResponse<unknown>;
      return json.error === null;
    } catch {
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, []);

  return { deleteRating, isDeleting };
}

export function useUpdateSessionAttendees() {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateAttendees = useCallback(
    async (
      sessionId: string,
      added: readonly string[],
      removed: readonly string[],
    ): Promise<boolean> => {
      setIsUpdating(true);
      try {
        const promises: Promise<Response>[] = [];

        if (added.length > 0) {
          promises.push(
            fetchWithAuth(`/api/sessions/${sessionId}/attendees`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userIds: added }),
            }),
          );
        }

        for (const userId of removed) {
          promises.push(
            fetchWithAuth(`/api/sessions/${sessionId}/attendees?userId=${userId}`, {
              method: "DELETE",
            }),
          );
        }

        const results = await Promise.all(promises);
        return results.every((r) => r.ok);
      } catch {
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [],
  );

  return { updateAttendees, isUpdating };
}

export function useUpdateRating() {
  const [isUpdating, setIsUpdating] = useState(false);

  const updateRating = useCallback(
    async (
      ratingId: string,
      data: { score?: number; review?: string | null },
    ): Promise<boolean> => {
      setIsUpdating(true);
      try {
        const response = await fetchWithAuth(`/api/ratings/${ratingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = (await response.json()) as ApiResponse<unknown>;
        return json.error === null;
      } catch {
        return false;
      } finally {
        setIsUpdating(false);
      }
    },
    [],
  );

  return { updateRating, isUpdating };
}

// ============================================
// Timeline view (Database)
// ============================================

const TIMELINE_PAGE_SIZE = 20;

export interface TimelineFilters {
  type?: string;
  search?: string;
  /** Chronological order. Omitted defaults to the API's newest-first. */
  order?: "asc" | "desc";
}

/**
 * Build the SWR key for timeline page `index`. Returns null to stop paging once
 * the previous page reported no more results (this is `useSWRInfinite`'s
 * "reached the end" signal). Pure and exported for tests.
 */
export function timelinePageKey(
  index: number,
  previousPage: TimelinePayload | null,
  filters: TimelineFilters,
): string | null {
  if (previousPage !== null && !previousPage.hasMore) {
    return null;
  }
  const params = new URLSearchParams({ include: "timeline" });
  if (filters.type !== undefined && filters.type.length > 0) {
    params.set("type", filters.type);
  }
  if (filters.search !== undefined && filters.search.length > 0) {
    params.set("search", filters.search);
  }
  if (filters.order !== undefined) {
    params.set("order", filters.order);
  }
  params.set("page", String(index + 1));
  params.set("limit", String(TIMELINE_PAGE_SIZE));
  return `/api/sessions?${params.toString()}`;
}

/** Concatenate all loaded pages into one ordered entry list. Pure, for tests. */
export function flattenTimelinePages(
  pages: readonly TimelinePayload[] | undefined,
): TimelineEntry[] {
  if (pages === undefined) {
    return [];
  }
  return pages.flatMap((p) => p.items);
}

/**
 * Loads the watch-session diary for the timeline view, one page at a time.
 * `loadMore()` appends the next page (no scroll/replace); type + search filter
 * the underlying sessions. Pass `enabled: false` (e.g. while the grid/list view
 * is active) to skip the request entirely until the timeline is shown.
 */
export function useSessionsTimeline(filters: TimelineFilters, enabled = true) {
  const { data, error, size, setSize, isLoading, isValidating } = useSWRInfinite<
    TimelinePayload,
    Error
  >(
    (index, previous: TimelinePayload | null) =>
      enabled ? timelinePageKey(index, previous, filters) : null,
    { revalidateFirstPage: false },
  );

  const items = useMemo(() => flattenTimelinePages(data), [data]);
  const hasMore = data?.at(-1)?.hasMore ?? false;
  const groupSize = data?.[0]?.groupSize ?? 0;
  // size > items-while-fetching: a new page key is in flight but its data hasn't
  // arrived yet, so the Load more button shows a spinner instead of re-firing.
  const isLoadingMore = isValidating && data !== undefined && size > data.length;

  const loadMore = useCallback(() => {
    void setSize((current) => current + 1);
  }, [setSize]);

  return {
    items,
    groupSize,
    hasMore,
    loadMore,
    isLoading: isLoading && data === undefined,
    isLoadingMore,
    isEmpty: !isLoading && items.length === 0,
    error,
  };
}
