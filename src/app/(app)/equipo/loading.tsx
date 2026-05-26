import { Skeleton } from '@/components/ui/skeleton';

export default function EquipoLoading() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="hidden sm:grid grid-cols-7 gap-4 border-b p-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="hidden sm:grid grid-cols-7 gap-4 border-b last:border-b-0 p-4"
          >
            {Array.from({ length: 7 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </div>
        ))}
        <div className="sm:hidden space-y-3 p-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border p-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-8 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
