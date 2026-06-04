import {
  Activity,
  AlertTriangle,
  Calendar,
  Info,
  Lightbulb,
  MessageSquare,
  Target,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Metric, Severity, Tip } from '@/lib/coaching/types';

const SEVERITY_STYLES: Record<Severity, { container: string; icon: React.ComponentType<{ className?: string }> }> = {
  warn: {
    container:
      'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
    icon: AlertTriangle
  },
  suggest: {
    container:
      'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30',
    icon: Lightbulb
  },
  info: {
    container:
      'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30',
    icon: Info
  }
};

const SEVERITY_ICON_COLOR: Record<Severity, string> = {
  warn: 'text-amber-700 dark:text-amber-300',
  suggest: 'text-blue-700 dark:text-blue-300',
  info: 'text-green-700 dark:text-green-300'
};

const METRIC_LINK_ICON: Record<Metric, React.ComponentType<{ className?: string }>> = {
  acwr: Activity,
  consistency: Target,
  evolution: TrendingUp,
  attendance: Calendar,
  observations: MessageSquare
};

const METRIC_LINK_LABEL: Record<Metric, string> = {
  acwr: 'Ver carga',
  consistency: 'Ver consistencia',
  evolution: 'Ver evolución',
  attendance: 'Ver asistencia',
  observations: 'Ver observaciones'
};

type Props = {
  tip: Tip;
  /**
   * When provided, the tip renders an action link to the relevant chart
   * or section. For "athlete" audience it routes to /mi-progreso; for
   * "coach" audience it routes to /deportistas/[athleteId].
   */
  athleteId?: string;
  /** Visual density — compact omits the metric link footer. */
  compact?: boolean;
};

export function CoachingTipCard({ tip, athleteId, compact }: Props) {
  const sev = SEVERITY_STYLES[tip.severity];
  const Icon = sev.icon;
  const MetricIcon = tip.metric ? METRIC_LINK_ICON[tip.metric] : null;

  const linkHref = (() => {
    if (compact || !tip.metric || !athleteId) return null;
    return tip.audience === 'athlete'
      ? '/mi-progreso'
      : `/deportistas/${athleteId}`;
  })();

  return (
    <div
      className={cn(
        'rounded-xl border p-3 shadow-sm transition animate-fade-in-up',
        sev.container
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background/80',
            SEVERITY_ICON_COLOR[tip.severity]
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{tip.title}</p>
          <p className="mt-1 text-xs text-muted-foreground leading-snug">
            {tip.detail}
          </p>
          {linkHref && MetricIcon && tip.metric && (
            <a
              href={linkHref}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            >
              <MetricIcon className="h-3 w-3" aria-hidden />
              {METRIC_LINK_LABEL[tip.metric]}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
