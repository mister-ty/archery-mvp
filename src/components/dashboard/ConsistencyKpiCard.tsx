import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

type Props = {
  /** Sample stddev for the current window. `null` = not enough data. */
  current: number | null;
  /** Stddev for the previous window. Used to compute the delta. */
  previous: number | null;
};

/**
 * Card for "Consistencia" (sample stddev of recent arrow scores).
 *
 * Reading conventions: LOWER is BETTER (less variance ⇒ more consistent).
 * Trend arrow is reversed vs a normal "average" card.
 */
export function ConsistencyKpiCard({ current, previous }: Props) {
  const delta =
    current !== null && previous !== null
      ? Number((current - previous).toFixed(2))
      : null;

  let trendIcon: React.ReactNode = null;
  let trendClass = 'text-muted-foreground';
  if (delta !== null) {
    if (delta < -0.05) {
      trendIcon = <TrendingDown className="h-3 w-3" aria-hidden />;
      trendClass = 'text-green-600 dark:text-green-400';
    } else if (delta > 0.05) {
      trendIcon = <TrendingUp className="h-3 w-3" aria-hidden />;
      trendClass = 'text-red-600 dark:text-red-400';
    } else {
      trendIcon = <Minus className="h-3 w-3" aria-hidden />;
    }
  }

  return (
    <div className="group flex flex-col gap-1 rounded-xl border bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover">
      <span className="text-xs text-muted-foreground">Consistencia</span>
      <span className="flex items-baseline gap-1.5">
        {current !== null ? (
          <>
            <span className="text-2xl font-bold tabular-nums leading-none">
              ±{current.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">pts</span>
          </>
        ) : (
          <span className="text-xl text-muted-foreground">—</span>
        )}
      </span>
      {delta !== null && (
        <span
          className={`flex items-center gap-1 text-xs tabular-nums ${trendClass}`}
          title="vs 30 días anteriores · menor σ = más consistente"
        >
          {trendIcon}
          {delta > 0 ? '+' : ''}
          {delta.toFixed(2)} vs 30d anteriores
        </span>
      )}
    </div>
  );
}
