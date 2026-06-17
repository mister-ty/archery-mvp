import { Skeleton } from '@/components/ui/skeleton';

export default function AthleteLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      <Skeleton className="h-4 w-24" />
      <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-44" />
          </div>
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-[260px] w-full rounded-xl" />
      {/* Mirrors the lg 2-col chart grid (consistencia + volumen) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <Skeleton className="h-[200px] w-full rounded-xl" />
      </div>
    </div>
  );
}
