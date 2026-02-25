"use client";

import { GridIcon, ListIcon, PlusIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { MediaCard } from "@/components/media/media-card";
import type { MediaFilterValues } from "@/components/media/media-filters";
import { MediaFilters } from "@/components/media/media-filters";
import { MediaPagination } from "@/components/media/media-pagination";
import { MediaTable } from "@/components/media/media-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMediaList } from "@/hooks/use-media";

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
    setImportOpen(false);
    void mutate();
  }, [mutate]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Database</h1>
          <p className="text-muted-foreground mt-1">
            {data === undefined
              ? "Browse movies, TV shows, and anime."
              : `${String(data.total)} titles`}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
