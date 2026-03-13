"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function PredictionSkeleton() {
  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      {/* Poster */}
      <Skeleton className="aspect-[2/3] w-[120px] shrink-0 rounded-lg" />

      {/* Score + details */}
      <div className="flex-1 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        {/* Signal breakdown */}
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={String(index)} className="flex items-center gap-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-32" />
              <Skeleton className="h-3 w-48 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
