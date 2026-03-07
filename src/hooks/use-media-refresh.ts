"use client";

import { useCallback, useRef, useState } from "react";

import type { ApiResponse } from "@/lib/api/response";

interface BatchResponse {
  refreshed: number;
  failed: number;
  remaining: number;
  nextCursor: string | null;
  total: number;
  errors: { id: string; title: string; error: string }[];
}

export interface RefreshProgress {
  isRunning: boolean;
  total: number;
  completed: number;
  failed: number;
}

export function useMediaRefresh() {
  const [progress, setProgress] = useState<RefreshProgress>({
    isRunning: false,
    total: 0,
    completed: 0,
    failed: 0,
  });
  const cancelledReference = useRef(false);

  const startRefresh = useCallback(async (): Promise<RefreshProgress> => {
    cancelledReference.current = false;
    setProgress({ isRunning: true, total: 0, completed: 0, failed: 0 });

    let cursor: string | undefined;
    let totalCompleted = 0;
    let totalFailed = 0;
    let totalCount = 0;

    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- ref is mutated externally by cancelRefresh
      while (!cancelledReference.current) {
        const response = await fetch("/api/admin/media/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cursor }),
        });

        const json = (await response.json()) as ApiResponse<BatchResponse>;
        if (json.error !== null) {
          break;
        }

        const batch = json.data;
        totalCount = batch.total;
        totalCompleted += batch.refreshed;
        totalFailed += batch.failed;

        setProgress({
          isRunning: true,
          total: totalCount,
          completed: totalCompleted,
          failed: totalFailed,
        });

        if (batch.nextCursor === null) {
          break;
        }
        cursor = batch.nextCursor;
      }
    } catch {
      // Network error — stop gracefully
    }

    const finalProgress: RefreshProgress = {
      isRunning: false,
      total: totalCount,
      completed: totalCompleted,
      failed: totalFailed,
    };
    setProgress(finalProgress);
    return finalProgress;
  }, []);

  const cancelRefresh = useCallback(() => {
    cancelledReference.current = true;
  }, []);

  return { progress, startRefresh, cancelRefresh };
}

export function useSingleMediaRefresh() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshMedia = useCallback(async (id: string): Promise<boolean> => {
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/media/${id}/refresh`, { method: "POST" });
      const json = (await response.json()) as ApiResponse<unknown>;
      return json.error === null;
    } catch {
      return false;
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  return { refreshMedia, isRefreshing };
}
