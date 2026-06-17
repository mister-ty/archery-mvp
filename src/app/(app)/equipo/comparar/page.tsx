import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { ChevronLeft, GitCompare } from 'lucide-react';
import { auth } from '@/lib/auth';
import { compareAthletes, type CompareRow } from '@/server/actions/compare';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';

export const dynamic = 'force-dynamic';

const ZONE_LABEL: Record<CompareRow['acwrZone'], string> = {
  inactive: 'Inactivo',
  low: 'Baja',
  optimal: 'Óptimo',
  caution: 'Precaución',
  overload: 'Sobrecarga'
};
const ZONE_CLASS: Record<CompareRow['acwrZone'], string> = {
  inactive: 'text-zinc-500',
  low: 'text-blue-600 dark:text-blue-400',
  optimal: 'text-green-600 dark:text-green-400',
  caution: 'text-amber-600 dark:text-amber-400',
  overload: 'text-red-600 dark:text-red-400'
};

function fmt(n: number | null, suffix = ''): string {
  return n === null ? '—' : `${n}${suffix}`;
}

export default async function ComparePage({
  searchParams
}: {
  searchParams: { ids?: string };
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  const isStaff =
    role === Role.COACH || role === Role.CLUB_ADMIN || role === Role.SUPER_ADMIN;
  if (!isStaff) redirect('/mi-progreso');

  const ids = (searchParams.ids ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length < 2) {
    return (
      <div className="space-y-6">
        <Link
          href="/equipo"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" />
          Mi Equipo
        </Link>
        <PageHeader
          eyebrow="Análisis"
          title="Comparar deportistas"
          description="Tabla side-by-side de las métricas clave"
        />
        <EmptyState
          icon={GitCompare}
          title="Selecciona al menos 2 deportistas"
          description="Vuelve a Mi Equipo, marca las casillas y pulsa Comparar."
          action={
            <Link href="/equipo" className="btn-outline h-9">
              Ir a Mi Equipo
            </Link>
          }
        />
      </div>
    );
  }

  const rows = await compareAthletes(ids);

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <Link
          href="/equipo"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
        >
          <ChevronLeft className="h-3 w-3" />
          Mi Equipo
        </Link>
        <PageHeader eyebrow="Análisis" title="Comparar deportistas" />
        <EmptyState
          icon={GitCompare}
          title="Sin acceso a estos deportistas"
          description="No tienes permiso sobre los deportistas seleccionados, o no existen."
        />
      </div>
    );
  }

  // Best-of-row highlighters (semantics aware: lower stddev is better,
  // higher avg is better, etc.).
  const best = {
    avgLast30: Math.max(
      ...rows.map((r) => r.avgLast30 ?? -Infinity)
    ),
    stddevLast30: Math.min(
      ...rows.map((r) => r.stddevLast30 ?? Infinity)
    ),
    bestRound: Math.max(...rows.map((r) => r.bestRound ?? -Infinity)),
    arrowsLast30: Math.max(...rows.map((r) => r.arrowsLast30))
  };

  const cellHighlight = 'font-semibold text-foreground bg-success/10';

  return (
    <div className="space-y-6">
      <Link
        href="/equipo"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" />
        Mi Equipo
      </Link>

      <PageHeader
        eyebrow="Análisis"
        title="Comparar deportistas"
        description={`${rows.length} deportistas · últimos 30 días + histórico`}
      />

      {/* Legend for the best-of-group highlight — without it the green
          cells read as "selected" instead of "best". */}
      <p className="-mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className="inline-block h-3 w-3 rounded-sm bg-success/30 ring-1 ring-success/40"
          aria-hidden
        />
        Mejor del grupo en cada métrica
      </p>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs font-medium text-muted-foreground bg-muted/40">
              <th className="py-3 pl-4 pr-3 sticky left-0 bg-muted/40 z-10">
                Métrica
              </th>
              {rows.map((r) => (
                <th key={r.id} className="py-3 px-3 text-right">
                  <Link
                    href={`/deportistas/${r.id}`}
                    className="inline-flex items-center justify-end gap-2 transition hover:text-primary"
                  >
                    <Avatar
                      name={`${r.firstName} ${r.lastName}`}
                      size="xs"
                      className="!h-6 !w-6"
                    />
                    <span className="font-semibold">
                      {r.firstName} {r.lastName}
                    </span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            <tr>
              <td className="py-2 pr-3 sticky left-0 bg-card pl-4 text-muted-foreground">
                Modalidad
              </td>
              {rows.map((r) => (
                <td key={r.id} className="py-2 pr-3 text-right text-muted-foreground">
                  {r.bowModality}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 pr-3 sticky left-0 bg-card pl-4 text-muted-foreground">
                Categoría
              </td>
              {rows.map((r) => (
                <td key={r.id} className="py-2 pr-3 text-right text-muted-foreground">
                  {r.category}
                </td>
              ))}
            </tr>

            <tr>
              <td className="py-2 pr-3 sticky left-0 bg-card pl-4">
                Promedio 30d
              </td>
              {rows.map((r) => (
                <td
                  key={r.id}
                  className={`py-2 pr-3 text-right tabular-nums ${
                    r.avgLast30 !== null && r.avgLast30 === best.avgLast30
                      ? cellHighlight
                      : ''
                  }`}
                >
                  {fmt(r.avgLast30, ' pts')}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 pr-3 sticky left-0 bg-card pl-4">
                Consistencia 30d (σ)
              </td>
              {rows.map((r) => (
                <td
                  key={r.id}
                  className={`py-2 pr-3 text-right tabular-nums ${
                    r.stddevLast30 !== null && r.stddevLast30 === best.stddevLast30
                      ? cellHighlight
                      : ''
                  }`}
                >
                  {r.stddevLast30 !== null ? `±${r.stddevLast30.toFixed(2)}` : '—'}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 pr-3 sticky left-0 bg-card pl-4">
                Mejor ronda
              </td>
              {rows.map((r) => (
                <td
                  key={r.id}
                  className={`py-2 pr-3 text-right tabular-nums ${
                    r.bestRound !== null && r.bestRound === best.bestRound
                      ? cellHighlight
                      : ''
                  }`}
                >
                  {fmt(r.bestRound, ' pts')}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 pr-3 sticky left-0 bg-card pl-4">
                Flechas 30d
              </td>
              {rows.map((r) => (
                <td
                  key={r.id}
                  className={`py-2 pr-3 text-right tabular-nums ${
                    r.arrowsLast30 === best.arrowsLast30 && best.arrowsLast30 > 0
                      ? cellHighlight
                      : ''
                  }`}
                >
                  {r.arrowsLast30}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 pr-3 sticky left-0 bg-card pl-4">
                Sesiones 30d
              </td>
              {rows.map((r) => (
                <td key={r.id} className="py-2 pr-3 text-right tabular-nums">
                  {r.sessionsLast30}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 pr-3 sticky left-0 bg-card pl-4">
                Carga (ACWR)
              </td>
              {rows.map((r) => (
                <td key={r.id} className="py-2 pr-3 text-right tabular-nums">
                  {r.acwrRatio !== null ? r.acwrRatio.toFixed(2) : '—'}{' '}
                  <span className={`text-[10px] ${ZONE_CLASS[r.acwrZone]}`}>
                    · {ZONE_LABEL[r.acwrZone]}
                  </span>
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 pr-3 sticky left-0 bg-card pl-4">
                Última sesión
              </td>
              {rows.map((r) => (
                <td key={r.id} className="py-2 pr-3 text-right text-muted-foreground tabular-nums">
                  {r.daysSinceLastSession === null
                    ? '—'
                    : r.daysSinceLastSession === 0
                      ? 'hoy'
                      : `hace ${r.daysSinceLastSession}d`}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 pr-3 sticky left-0 bg-card pl-4">
                Competiciones
              </td>
              {rows.map((r) => (
                <td key={r.id} className="py-2 pr-3 text-right tabular-nums">
                  {r.competitionsCount}
                </td>
              ))}
            </tr>
            <tr>
              <td className="py-2 pr-3 sticky left-0 bg-card pl-4">
                Mejor competición
              </td>
              {rows.map((r) => (
                <td key={r.id} className="py-2 pr-3 text-right text-xs">
                  {r.bestCompetition ? (
                    <>
                      <span className="font-medium tabular-nums">
                        {r.bestCompetition.totalScore}
                      </span>
                      <br />
                      <span className="text-muted-foreground">
                        {r.bestCompetition.name}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
