import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SESSION_TYPE_LABEL } from '@/lib/session-labels';
import { formatRelativeDate } from '@/lib/analytics/session-status';
import type { UpcomingSession } from '@/server/actions/dashboard';

type Props = {
  sessions: UpcomingSession[];
};

const STATUS_META = {
  pending: {
    label: 'Sin empezar',
    cta: 'Capturar',
    badge:
      'border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:bg-amber-950/30',
    icon: Clock
  },
  partial: {
    label: 'En progreso',
    cta: 'Continuar',
    badge:
      'border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:bg-blue-950/30',
    icon: Activity
  },
  complete: {
    label: 'Completa',
    cta: 'Ver detalle',
    badge:
      'border-green-300 text-green-700 bg-green-50 dark:border-green-800 dark:text-green-300 dark:bg-green-950/30',
    icon: CheckCircle2
  }
} as const;

function timeLabel(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function fallbackDateLabel(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  }).format(date);
}

export function AthleteUpcomingSessions({ sessions }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed bg-card p-4 shadow-sm animate-fade-in-up">
        <div className="min-w-0">
          <p className="text-sm font-semibold">No tienes sesiones pendientes</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Empieza una sesión ahora mismo y captura tus flechas.
          </p>
        </div>
        <Link
          href="/mi-progreso/nueva-sesion"
          className="btn-primary h-10 shrink-0"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden />
          Nueva sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2 animate-fade-in-up">
      {sessions.map((s) => {
        const meta = STATUS_META[s.status];
        const Icon = meta.icon;
        const ratio =
          s.expectedArrows > 0
            ? Math.min(100, Math.round((s.capturedArrows / s.expectedArrows) * 100))
            : 0;
        const relative = formatRelativeDate(s.date) ?? fallbackDateLabel(s.date);
        const href =
          s.status === 'complete'
            ? `/sesion/${s.id}`
            : `/sesion/${s.id}/puntuacion`;

        return (
          <Link
            key={s.id}
            href={href}
            className="group block rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                      meta.badge
                    )}
                  >
                    <Icon className="h-3 w-3" aria-hidden />
                    {meta.label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {relative} · {timeLabel(s.date)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-semibold">
                  {SESSION_TYPE_LABEL[s.type] ?? s.type}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {s.indoor ? 'Indoor' : 'Outdoor'} · {s.distanceSummary}
                  </span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {s.capturedArrows} / {s.expectedArrows} flechas · {ratio}%
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1 self-center text-sm font-semibold text-primary group-hover:translate-x-0.5 transition">
                <span className="hidden sm:inline">{meta.cta}</span>
                <ChevronRight className="h-4 w-4" aria-hidden />
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${ratio}%` }}
              />
            </div>
          </Link>
        );
      })}
      <Link
        href="/mi-progreso/nueva-sesion"
        className="group flex items-center justify-between rounded-2xl border border-dashed bg-card p-3 text-sm text-muted-foreground transition hover:border-primary/40 hover:bg-muted/40"
      >
        <span className="flex items-center gap-2">
          <CalendarPlus className="h-4 w-4" aria-hidden />
          ¿Vas a entrenar por tu cuenta? Empieza una sesión rápida.
        </span>
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </div>
  );
}
