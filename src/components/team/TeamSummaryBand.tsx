import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  Crown,
  Pause,
  TrendingUp,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClubSummary } from '@/lib/analytics/team-aggregate';
import type { AcwrZone } from '@/lib/analytics/training-load';

type Props = {
  summary: ClubSummary;
};

const ZONE_META: Record<
  AcwrZone,
  { label: string; classes: string; icon: React.ComponentType<{ className?: string }> }
> = {
  inactive: {
    label: 'Inactivos',
    classes:
      'border-zinc-300 text-zinc-700 bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:bg-zinc-900',
    icon: Pause
  },
  low: {
    label: 'Carga baja',
    classes:
      'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:bg-blue-950/30',
    icon: Pause
  },
  optimal: {
    label: 'Óptimos',
    classes:
      'border-green-300 text-green-700 bg-green-50 dark:border-green-800 dark:text-green-300 dark:bg-green-950/30',
    icon: Activity
  },
  caution: {
    label: 'Precaución',
    classes:
      'border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:bg-amber-950/30',
    icon: AlertTriangle
  },
  overload: {
    label: 'Sobrecarga',
    classes:
      'border-red-300 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-300 dark:bg-red-950/30',
    icon: Zap
  }
};

const ZONE_ORDER: AcwrZone[] = [
  'optimal',
  'caution',
  'overload',
  'low',
  'inactive'
];

function MetricCell({
  label,
  value,
  hint
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-xl sm:text-2xl font-bold tabular-nums leading-none tracking-tight">
        {value}
      </span>
      {hint && (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      )}
    </div>
  );
}

export function TeamSummaryBand({ summary }: Props) {
  if (summary.athleteCount === 0) {
    return null; // EmptyState ya cubre este caso en el page parent.
  }

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-card animate-fade-in-up">
      {/* Métricas top */}
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <MetricCell
          label="Deportistas"
          value={summary.athleteCount}
          hint="activos"
        />
        <MetricCell
          label="Promedio club"
          value={
            summary.avgClubScore !== null ? (
              <>
                {summary.avgClubScore}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  pts
                </span>
              </>
            ) : (
              <span className="text-base text-muted-foreground">—</span>
            )
          }
          hint="ponderado por flechas"
        />
        <MetricCell
          label="Flechas 30d"
          value={summary.totalArrowsLast30}
          hint={`${summary.totalSessionsLast30} sesiones`}
        />
        <MetricCell
          label="Consistencia"
          value={
            summary.meanConsistency !== null ? (
              <>
                ±{summary.meanConsistency.toFixed(2)}
              </>
            ) : (
              <span className="text-base text-muted-foreground">—</span>
            )
          }
          hint="σ promedio del club"
        />
      </div>

      {/* Zone breakdown como chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">
          Carga del equipo
        </span>
        {ZONE_ORDER.map((zone) => {
          const count = summary.zoneBreakdown[zone];
          if (count === 0) return null;
          const meta = ZONE_META[zone];
          const Icon = meta.icon;
          return (
            <span
              key={zone}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                meta.classes
              )}
            >
              <Icon className="h-3 w-3" aria-hidden />
              <span className="font-semibold tabular-nums">{count}</span>
              {meta.label}
            </span>
          );
        })}
      </div>

      {/* Spotlights */}
      {(summary.topPerformer || summary.biggestImprover) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1 border-t">
          {summary.topPerformer && (
            <Link
              href={`/deportistas/${summary.topPerformer.id}`}
              className="group flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 transition hover:bg-muted/40"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                <Crown className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Top performer (30d)
                </p>
                <p className="text-sm font-semibold truncate group-hover:text-primary transition">
                  {summary.topPerformer.name}{' '}
                  <span className="font-normal text-muted-foreground tabular-nums">
                    · {summary.topPerformer.avgLast30.toFixed(1)} pts
                  </span>
                </p>
              </div>
            </Link>
          )}
          {summary.biggestImprover && (
            <Link
              href={`/deportistas/${summary.biggestImprover.id}`}
              className="group flex items-center gap-3 rounded-lg px-2 py-1.5 -mx-2 transition hover:bg-muted/40"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                <TrendingUp className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Mayor mejora vs 30d previos
                </p>
                <p className="text-sm font-semibold truncate group-hover:text-primary transition">
                  {summary.biggestImprover.name}{' '}
                  <span className="font-normal text-green-600 dark:text-green-400 tabular-nums">
                    +{summary.biggestImprover.delta.toFixed(2)}
                  </span>
                </p>
              </div>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

