/**
 * Hooks for session and rating mutations
 */

import { useCallback, useState } from "react";

import { fetchWithAuth } from "@/lib/api/fetch-with-auth";
import type { ApiResponse } from "@/lib/api/response";

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
    async (ratingId: string, data: { score?: number; review?: string }): Promise<boolean> => {
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
