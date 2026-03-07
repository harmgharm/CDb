"use client";

import { GridIcon, ListIcon, LoaderIcon, PlusIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { MediaCard } from "@/components/media/media-card";
import type { MediaFilterValues } from "@/components/media/media-filters";
import { MediaFilters } from "@/components/media/media-filters";
import { MediaPagination } from "@/components/media/media-pagination";
import { MediaTable } from "@/components/media/media-table";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaList } from "@/hooks/use-media";
import { useMediaRefresh } from "@/hooks/use-media-refresh";

import { ImportMediaDialog } from "./import-dialog";

type ViewMode = "grid" | "list";

function MediaGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className="overflow-hidden rounded-lg border">
          <Skeleton className="aspect-[2/3] w-full" />
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MediaListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-16 w-full rounded-md" />
      ))}
    </div>
  );
}

export default function DatabasePage() {
  const { user } = useAuth();
  const { progress, startRefresh, cancelRefresh } = useMediaRefresh();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [importOpen, setImportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<MediaFilterValues>({
    search: "",
    type: "",
    sortBy: "created_at",
    sortOrder: "desc",
  });

  const { data, isLoading, mutate } = useMediaList({
    search: filters.search.length > 0 ? filters.search : undefined,
    type: filters.type.length > 0 ? filters.type : undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    page,
    limit: 20,
  });

  const handleFilterChange = useCallback((newFilters: MediaFilterValues) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  const handleImportSuccess = useCallback(() => {
    void mutate();
  }, [mutate]);

  const isModeratorOrAdmin = user?.role === "admin" || user?.role === "moderator";

  const handleRefresh = useCallback(async () => {
    const result = await startRefresh();
    void mutate();
    if (result.failed === 0) {
      toast.success(`Refreshed ${String(result.completed)} entries`);
    } else {
      toast.warning(
        `Refreshed ${String(result.completed)}, failed ${String(result.failed)} entries`,
      );
    }
  }, [startRefresh, mutate]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Database</h1>
          <p className="text-muted-foreground mt-1">
            {data === undefined
              ? "Browse movies, TV shows, and anime."
              : `${String(data.total)} titles`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="size-8 rounded-r-none"
              onClick={() => {
                setViewMode("grid");
              }}
            >
              <GridIcon className="size-4" />
              <span className="sr-only">Grid view</span>
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="size-8 rounded-l-none"
              onClick={() => {
                setViewMode("list");
              }}
            >
              <ListIcon className="size-4" />
              <span className="sr-only">List view</span>
            </Button>
          </div>
          {isModeratorOrAdmin && !progress.isRunning && (
            <Button
              variant="outline"
              onClick={() => {
                void handleRefresh();
              }}
            >
              <RefreshCwIcon className="mr-2 size-4" />
              Refresh Database
            </Button>
          )}
          {isModeratorOrAdmin && progress.isRunning && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                <LoaderIcon className="mr-1 inline size-3 animate-spin" />
                {progress.total > 0
                  ? `Refreshing ${String(progress.completed)}/${String(progress.total)}...`
                  : "Refreshing..."}
              </span>
              <Button variant="outline" size="sm" onClick={cancelRefresh}>
                <XIcon className="mr-1 size-3" />
                Cancel
              </Button>
            </div>
          )}
          <Button
            onClick={() => {
              setImportOpen(true);
            }}
          >
            <PlusIcon className="mr-2 size-4" />
            Add Media
          </Button>
        </div>
      </div>

      <MediaFilters filters={filters} onFilterChange={handleFilterChange} />

      {isLoading && viewMode === "grid" && <MediaGridSkeleton />}
      {isLoading && viewMode === "list" && <MediaListSkeleton />}

      {!isLoading && data?.items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground text-lg">No media found</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {filters.search.length > 0 || filters.type.length > 0
              ? "Try adjusting your filters."
              : "Import some movies, shows, or anime to get started!"}
          </p>
          {filters.search.length === 0 && filters.type.length === 0 && (
            <Button
              className="mt-4"
              onClick={() => {
                setImportOpen(true);
              }}
            >
              <PlusIcon className="mr-2 size-4" />
              Add Media
            </Button>
          )}
        </div>
      )}

      {!isLoading && data !== undefined && data.items.length > 0 && (
        <>
          {viewMode === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {data.items.map((media, index) => (
                <MediaCard key={media.id} media={media} index={index} />
              ))}
            </div>
          ) : (
            <MediaTable items={data.items} />
          )}

          <MediaPagination page={page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      )}

      <ImportMediaDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}
