import { Activity, AlertTriangle, Pause, Zap } from 'lucide-react';
import type { Acwr, AcwrZone } from '@/lib/analytics/training-load';

type Props = {
  acwr: Acwr;
  daysSinceLastSession: number | null;
};

const ZONE_STYLES: Record<
  AcwrZone,
  { label: string; chip: string; helper: string; icon: React.ReactNode }
> = {
  inactive: {
    label: 'Inactivo',
    chip:
      'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700',
    helper: 'Sin sesiones recientes',
    icon: <Pause className="h-3 w-3" aria-hidden />
  },
  low: {
    label: 'Carga baja',
    chip:
      'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
    helper: 'Volumen reciente bajo vs el habitual',
    icon: <Pause className="h-3 w-3" aria-hidden />
  },
  optimal: {
    label: 'Óptimo',
    chip:
      'bg-green-50 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
    helper: 'Carga sostenible (0.8–1.3)',
    icon: <Activity className="h-3 w-3" aria-hidden />
  },
  caution: {
    label: 'Precaución',
    chip:
      'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    helper: 'Carga por encima de lo habitual',
    icon: <AlertTriangle className="h-3 w-3" aria-hidden />
  },
  overload: {
    label: 'Sobrecarga',
    chip:
      'bg-red-50 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
    helper: 'Pico agudo — considera moderar',
    icon: <Zap className="h-3 w-3" aria-hidden />
  }
};

export function TrainingLoadCard({ acwr, daysSinceLastSession }: Props) {
  const z = ZONE_STYLES[acwr.zone];
  const ratioText =
    acwr.ratio !== null ? acwr.ratio.toFixed(2) : '—';

  return (
    <div className="group flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-muted-foreground">Carga de entrenamiento</span>
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${z.chip}`}
          role="status"
          aria-label={`Zona ACWR: ${z.label}`}
        >
          {z.icon}
          {z.label}
        </span>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold tabular-nums leading-none">{ratioText}</span>
        <span className="text-xs text-muted-foreground">ACWR</span>
      </div>

      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>
          <span className="font-medium tabular-nums text-foreground">
            {acwr.acuteArrows}
          </span>{' '}
          flechas (7d) ·{' '}
          <span className="font-medium tabular-nums text-foreground">
            {acwr.chronicArrowsPerWeek !== null
              ? acwr.chronicArrowsPerWeek.toFixed(1)
              : '—'}
          </span>{' '}
          /sem (28d)
        </p>
        <p>
          {daysSinceLastSession !== null
            ? daysSinceLastSession === 0
              ? 'Última sesión: hoy'
              : `Última sesión: hace ${daysSinceLastSession}d`
            : 'Sin sesiones registradas'}
        </p>
        <p className="text-[10px] italic">{z.helper}</p>
      </div>
    </div>
  );
}
