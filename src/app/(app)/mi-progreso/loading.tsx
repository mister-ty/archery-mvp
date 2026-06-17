import { Skeleton } from '@/components/ui/skeleton';

function KpiSkeleton() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

export default function ProgressLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-[260px] w-full rounded-xl" />
      {/* Mirrors the lg 2-col chart grid (consistencia + volumen) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-[200px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
