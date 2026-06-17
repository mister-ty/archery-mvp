'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Clock,
  GitCompare,
  TrendingDown,
  TrendingUp,
  Users
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import type { TeamAthlete } from '@/server/actions/dashboard';

type Props = {
  athletes: TeamAthlete[];
};

const MAX_COMPARE = 6;

/** "hoy" / "hace 3d" — faster to scan than an absolute date in a dense table. */
function relativeDays(date: Date | string): string {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000)
  );
  return days === 0 ? 'hoy' : `hace ${days}d`;
}

export function TeamRoster({ athletes }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const alerts = useMemo(
    () => athletes.filter((a) => a.alert !== 'none'),
    [athletes]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_COMPARE) {
        next.add(id);
      }
      return next;
    });
  };

  const goCompare = () => {
    if (selected.size < 2) return;
    router.push(`/equipo/comparar?ids=${[...selected].join(',')}`);
  };

  return (
    <>
      {/* Alert banner */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 space-y-1">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            {alerts.length} deportista{alerts.length > 1 ? 's' : ''} requiere
            {alerts.length === 1 ? '' : 'n'} atención
          </p>
          <ul className="space-y-0.5">
            {alerts.map((a) => (
              <li key={a.id} className="text-xs text-amber-700 dark:text-amber-300">
                <Link
                  href={`/deportistas/${a.id}`}
                  className="hover:underline font-medium"
                >
                  {a.firstName} {a.lastName}
                </Link>{' '}
                —{' '}
                {a.alert === 'inactive'
                  ? 'sin sesión en más de 14 días'
                  : `caída de ${Math.abs(a.delta ?? 0).toFixed(1)} pts en promedio`}
              </li>
            ))}
          </ul>
        </div>
      )}

      {athletes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No hay deportistas activos"
          description="Crea o invita a tus deportistas para empezar el seguimiento del equipo."
          action={
            <Link href="/deportistas/nuevo" className="btn-primary h-9">
              Añadir deportista
            </Link>
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="pb-2 pr-2 w-8" aria-label="Comparar"></th>
                  <th className="pb-2 pr-4">Deportista</th>
                  <th className="pb-2 pr-4">Modalidad</th>
                  <th className="pb-2 pr-4">Categoría</th>
                  <th className="pb-2 pr-4 text-right">Prom. 30d</th>
                  <th className="pb-2 pr-4 text-right">Delta</th>
                  <th className="pb-2 pr-4 text-right">Asistencia</th>
                  <th className="pb-2 text-right">Última sesión</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {athletes.map((a) => {
                  const isChecked = selected.has(a.id);
                  const atCapacity = selected.size >= MAX_COMPARE && !isChecked;
                  return (
                    <tr key={a.id} className="hover:bg-muted/40 transition">
                      <td className="py-2.5 pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={atCapacity}
                          onChange={() => toggle(a.id)}
                          aria-label={`Seleccionar ${a.firstName} ${a.lastName} para comparar`}
                          className="h-5 w-5 accent-primary disabled:opacity-40 cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 pr-4">
                        <Link
                          href={`/deportistas/${a.id}`}
                          className="flex items-center gap-2 font-medium hover:text-primary"
                        >
                          <Avatar
                            name={`${a.firstName} ${a.lastName}`}
                            size="xs"
                          />
                          {a.alert !== 'none' && (
                            <AlertTriangle
                              className={`h-3.5 w-3.5 shrink-0 ${
                                a.alert === 'inactive'
                                  ? 'text-amber-500'
                                  : 'text-red-500'
                              }`}
                            />
                          )}
                          {a.firstName} {a.lastName}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {a.bowModality}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {a.category}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        {a.avgLast30 !== null ? a.avgLast30 : '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        {a.delta !== null ? (
                          <span
                            className={`inline-flex items-center justify-end gap-1 ${
                              a.delta >= 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {a.delta >= 0 ? (
                              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <TrendingDown className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {a.delta >= 0 ? '+' : ''}
                            {a.delta}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">
                        {a.attendancePct !== null ? `${a.attendancePct}%` : '—'}
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {a.lastSessionDate ? (
                          <span
                            className="flex items-center justify-end gap-1 tabular-nums"
                            title={new Date(a.lastSessionDate).toLocaleDateString(
                              'es-CO',
                              { day: 'numeric', month: 'short', year: 'numeric' }
                            )}
                          >
                            {a.alert === 'inactive' && (
                              <Clock className="h-3.5 w-3.5 text-amber-500" />
                            )}
                            {relativeDays(a.lastSessionDate)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {athletes.map((a) => {
              const isChecked = selected.has(a.id);
              const atCapacity = selected.size >= MAX_COMPARE && !isChecked;
              return (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={atCapacity}
                    onChange={() => toggle(a.id)}
                    aria-label={`Seleccionar ${a.firstName} ${a.lastName}`}
                    className="h-5 w-5 shrink-0 accent-primary disabled:opacity-40 cursor-pointer"
                  />
                  <Link
                    href={`/deportistas/${a.id}`}
                    className="flex flex-1 min-w-0 items-center gap-3"
                  >
                    <Avatar
                      name={`${a.firstName} ${a.lastName}`}
                      size="sm"
                      className="shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-medium text-sm">
                        {a.alert !== 'none' && (
                          <AlertTriangle
                            className={`h-3.5 w-3.5 shrink-0 ${
                              a.alert === 'inactive'
                                ? 'text-amber-500'
                                : 'text-red-500'
                            }`}
                          />
                        )}
                        <span className="truncate">
                          {a.firstName} {a.lastName}
                        </span>
                      </span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {a.bowModality} · {a.category}
                      </span>
                      {a.lastSessionDate && (
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          Última: {relativeDays(a.lastSessionDate)}
                        </span>
                      )}
                    </span>
                  </Link>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold tabular-nums">
                      {a.avgLast30 !== null ? a.avgLast30 : '—'}
                    </p>
                    {a.delta !== null && (
                      <p
                        className={`flex items-center justify-end gap-0.5 text-xs tabular-nums ${
                          a.delta >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {a.delta >= 0 ? (
                          <TrendingUp className="h-3 w-3" aria-hidden />
                        ) : (
                          <TrendingDown className="h-3 w-3" aria-hidden />
                        )}
                        {a.delta >= 0 ? '+' : ''}
                        {a.delta}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Sticky compare bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-20 sm:bottom-4 z-30 px-4 animate-fade-in">
          <div className="mx-auto max-w-md rounded-xl border bg-card shadow-lg p-3 flex items-center justify-between gap-3">
            <div className="text-xs">
              <p className="font-medium">
                {selected.size} seleccionado{selected.size > 1 ? 's' : ''}
                {selected.size >= MAX_COMPARE && (
                  <span className="ml-1 text-muted-foreground">(máx)</span>
                )}
              </p>
              <p className="text-muted-foreground">
                Mínimo 2 para comparar
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={goCompare}
                disabled={selected.size < 2}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50 transition"
              >
                <GitCompare className="h-3.5 w-3.5" />
                Comparar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
