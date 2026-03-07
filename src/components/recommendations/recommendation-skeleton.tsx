"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface RecommendationSkeletonProps {
  readonly count?: number;
}

export function RecommendationSkeleton({ count = 5 }: RecommendationSkeletonProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }, (_, index) => (
        <div key={String(index)} className="space-y-2">
          <Skeleton className="aspect-[2/3] w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
