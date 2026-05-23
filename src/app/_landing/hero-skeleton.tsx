import { Skeleton } from "@/components/ui/skeleton";

export function HeroSkeleton() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#060403]">
      <div className="flex flex-col items-center gap-6">
        <Skeleton className="h-24 w-64" />
        <Skeleton className="h-5 w-72" />
        <Skeleton className="h-5 w-80" />
        <div className="flex gap-3">
          <Skeleton className="h-11 w-28" />
          <Skeleton className="h-11 w-28" />
        </div>
      </div>
    </section>
  );
}

export function TopRatedSkeleton() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <Skeleton className="mb-8 h-10 w-72" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="w-[150px] shrink-0 sm:w-[170px]">
            <Skeleton className="aspect-[2/3] w-full rounded-xl" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <Skeleton className="mt-1 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </section>
  );
}
