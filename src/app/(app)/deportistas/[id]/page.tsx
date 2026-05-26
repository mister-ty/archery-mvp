import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Role } from '@prisma/client';
import { ChevronLeft, Trophy } from 'lucide-react';
import { auth } from '@/lib/auth';
import { getAthleteDashboard } from '@/server/actions/dashboard';
import { listAthleteCompetitions } from '@/server/actions/competitions';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { ConsistencyKpiCard } from '@/components/dashboard/ConsistencyKpiCard';
import { TrainingLoadCard } from '@/components/dashboard/TrainingLoadCard';
import { EvolutionChart } from '@/components/dashboard/EvolutionChart';
import { ConsistencyChart } from '@/components/dashboard/ConsistencyChart';
import { WeeklyVolumeChart } from '@/components/dashboard/WeeklyVolumeChart';
import { ExportButtons } from '@/components/reports/ExportButtons';
import { CompetitionForm } from '@/components/competitions/CompetitionForm';
import { CompetitionList } from '@/components/competitions/CompetitionList';
import { Avatar } from '@/components/ui/avatar';
import { SectionHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';

const SESSION_TYPE_LABEL: Record<string, string> = {
  TECHNICAL: 'Técnica',
  SERIES: 'Series',
  COMPETITION_SIM: 'Sim. Competición',
  WARMUP: 'Calentamiento'
};

export default async function AthleteDetailPage({
  params
}: {
  params: { id: string };
}) {
  const [data, competitions, session] = await Promise.all([
    getAthleteDashboard(params.id),
    listAthleteCompetitions(params.id),
    auth()
  ]);
  if (!data) notFound();

  const { athlete, kpis, recentSessions, recentObservations, evolution } = data;
  const isStaff =
    session?.user?.role === Role.COACH ||
    session?.user?.role === Role.CLUB_ADMIN ||
    session?.user?.role === Role.SUPER_ADMIN;

  const fullName = `${athlete.firstName} ${athlete.lastName}`;

  return (
    <div className="space-y-6">
      <Link
        href="/deportistas"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" />
        Deportistas
      </Link>

      {/* Hero band */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-card animate-fade-in-up">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={fullName} size="lg" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Deportista
            </p>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {fullName}
            </h1>
          </div>
        </div>
        <ExportButtons
          athleteId={athlete.id}
          hasData={recentSessions.length > 0}
        />
      </div>

      {/* KPI cards */}
      <section>
        <SectionHeader title="Últimos 30 días" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Promedio" value={kpis.avgLast30} unit="pts" />
          <KpiCard label="Mejor ronda" value={kpis.bestRound} unit="pts" />
          <KpiCard label="Flechas (mes)" value={kpis.arrowsThisMonth} />
          <KpiCard label="Sesiones (mes)" value={kpis.sessionsThisMonth} />
          <ConsistencyKpiCard
            current={kpis.stddevLast30}
            previous={kpis.stddevPrev30}
          />
          <TrainingLoadCard
            acwr={data.trainingLoad.acwr}
            daysSinceLastSession={data.trainingLoad.daysSinceLastSession}
          />
        </div>
      </section>

      {/* Evolution chart */}
      <section>
        <SectionHeader title="Evolución por distancia" />
        <EvolutionChart data={evolution} />
      </section>

      {/* Consistency chart (Fase 2.1) */}
      <section>
        <SectionHeader title="Evolución de consistencia" />
        <ConsistencyChart data={data.consistencyTrend} />
      </section>

      {/* Weekly training volume (Fase 2.2) */}
      <section>
        <SectionHeader title="Volumen de entrenamiento" />
        <WeeklyVolumeChart data={data.trainingLoad.weekly} />
      </section>

      {/* Recent sessions */}
      <section>
        <SectionHeader title="Últimas sesiones" />
        {recentSessions.length === 0 ? (
          <EmptyState
            title="Sin sesiones registradas"
            description="Cuando este deportista entrene su primera sesión, aparecerá aquí."
          />
        ) : (
          <div className="space-y-2">
            {recentSessions.map((s) => (
              <Link
                key={s.id}
                href={`/sesion/${s.id}`}
                className="group flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover"
              >
                <div>
                  <p className="text-sm font-medium">
                    {SESSION_TYPE_LABEL[s.type] ?? s.type}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {s.indoor ? 'Indoor' : 'Outdoor'} · {s.distanceSummary}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.date).toLocaleDateString('es-CO', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short'
                    })}
                    {s.stddev !== null && (
                      <span className="ml-2 tabular-nums">
                        · σ ±{s.stddev.toFixed(2)}
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-lg font-bold tabular-nums">{s.total}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Observations */}
      {recentObservations.length > 0 && (
        <section>
          <SectionHeader title="Observaciones del coach" />
          <div className="space-y-2">
            {recentObservations.map((o) => (
              <Link
                key={o.id}
                href={`/sesion/${o.sessionId}`}
                className="block rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover"
              >
                <p className="text-sm line-clamp-2">{o.content}</p>
                {o.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {o.tags.map((t) => (
                      <span
                        key={t.id}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {o.coachName} · {new Date(o.createdAt).toLocaleDateString('es-CO')}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Competitions (Fase 2.3) */}
      <section>
        <SectionHeader
          title="Historial competitivo"
          description={
            competitions.length > 0
              ? `${competitions.length} registro${
                  competitions.length === 1 ? '' : 's'
                }`
              : undefined
          }
        />
        {isStaff && (
          <div className="mb-3 rounded-xl border bg-card p-4 shadow-card">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Registrar nueva competición
            </p>
            <CompetitionForm athleteId={athlete.id} />
          </div>
        )}
        <CompetitionList competitions={competitions} canEdit={isStaff} />
      </section>
    </div>
  );
}
