import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type Props = {
  label: string;
  value: string | number | null;
  unit?: string;
  empty?: string;
  icon?: LucideIcon;
  /** Optional secondary line (e.g. context, comparison). */
  hint?: string;
  className?: string;
};

export function KpiCard({
  label,
  value,
  unit,
  empty = '—',
  icon: Icon,
  hint,
  className
}: Props) {
  const isEmpty = value === null || value === undefined;
  return (
    <div
      className={cn(
        'group relative flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        {Icon && (
          <Icon
            className="h-3.5 w-3.5 text-muted-foreground/70 transition-colors group-hover:text-primary"
            aria-hidden
          />
        )}
      </div>
      <span className="flex items-baseline gap-1.5">
        {isEmpty ? (
          <span className="text-xl text-muted-foreground">{empty}</span>
        ) : (
          <>
            <span className="text-2xl font-bold tabular-nums leading-none">
              {value}
            </span>
            {unit && (
              <span className="text-xs font-normal text-muted-foreground">
                {unit}
              </span>
            )}
          </>
        )}
      </span>
      {hint && (
        <span className="text-[11px] text-muted-foreground/80">{hint}</span>
      )}
    </div>
  );
}
