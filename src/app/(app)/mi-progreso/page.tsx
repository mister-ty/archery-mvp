import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Crosshair,
  Target,
  Trophy,
  UserCircle2
} from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  getAthleteDashboard,
  getAthleteUpcomingSessions
} from '@/server/actions/dashboard';
import { listAthleteCompetitions } from '@/server/actions/competitions';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { ConsistencyKpiCard } from '@/components/dashboard/ConsistencyKpiCard';
import { TrainingLoadCard } from '@/components/dashboard/TrainingLoadCard';
import { EvolutionChart } from '@/components/dashboard/EvolutionChart';
import { ConsistencyChart } from '@/components/dashboard/ConsistencyChart';
import { WeeklyVolumeChart } from '@/components/dashboard/WeeklyVolumeChart';
import { AthleteUpcomingSessions } from '@/components/athlete/AthleteUpcomingSessions';
import { ArrowJourneyBackground } from '@/components/decor/ArrowJourneyBackground';
import { AthleteCoachingPanel } from '@/components/coaching/AthleteCoachingPanel';
import { CompetitionForm } from '@/components/competitions/CompetitionForm';
import { CompetitionList } from '@/components/competitions/CompetitionList';
import { ExportButtons } from '@/components/reports/ExportButtons';
import { PageHeader, SectionHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { SESSION_TYPE_LABEL } from '@/lib/session-labels';

export default async function MiProgresoPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  // For athletes: find their own athlete profile
  // For staff viewing their own progress: show placeholder
  let athleteId: string | null = null;

  if (session.user.role === Role.ATHLETE) {
    const athlete = await db.athlete.findFirst({
      where: { userId: session.user.id },
      select: { id: true }
    });
    athleteId = athlete?.id ?? null;
  }

  if (!athleteId) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Vista del deportista" title="Mi Progreso" />
        <EmptyState
          icon={UserCircle2}
          title="No tienes un perfil de deportista vinculado"
          description="Pide a tu coach o administrador que cree tu perfil para empezar a ver métricas."
          action={
            <Link href="/equipo" className="btn-outline h-9">
              Ver equipo
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
      </div>
    );
  }

  const [data, competitions, upcoming] = await Promise.all([
    getAthleteDashboard(athleteId),
    listAthleteCompetitions(athleteId),
    getAthleteUpcomingSessions(athleteId)
  ]);
  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Vista del deportista" title="Mi Progreso" />
        <EmptyState title="No se encontraron datos" />
      </div>
    );
  }

  return (
    <>
      <ArrowJourneyBackground />
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vista del deportista"
          title="Mi Progreso"
          description="Resumen de tu evolución y carga reciente"
        actions={
          <ExportButtons
            athleteId={athleteId}
            hasData={data.recentSessions.length > 0}
          />
        }
      />

      <section>
        <SectionHeader
          title="Mis sesiones"
          description="Sesiones de hoy y próximas, o pendientes recientes"
        />
        <AthleteUpcomingSessions sessions={upcoming} />
      </section>

      <AthleteCoachingPanel athleteId={athleteId} audience="athlete" />

      {/* KPI cards */}
      <section>
        <SectionHeader title="Últimos 30 días" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="Promedio"
            value={data.kpis.avgLast30}
            unit="pts"
            icon={Target}
            hint="por flecha"
          />
          <KpiCard
            label="Mejor ronda"
            value={data.kpis.bestRound}
            unit="pts"
            icon={Trophy}
            hint="máx. en una ronda"
          />
          <KpiCard
            label="Flechas"
            value={data.kpis.arrowsThisMonth}
            icon={Crosshair}
            hint="volumen del mes"
          />
          <KpiCard
            label="Sesiones"
            value={data.kpis.sessionsThisMonth}
            icon={CalendarDays}
            hint="entrenamientos"
          />
          <ConsistencyKpiCard
            current={data.kpis.stddevLast30}
            previous={data.kpis.stddevPrev30}
          />
          <TrainingLoadCard
            acwr={data.trainingLoad.acwr}
            daysSinceLastSession={data.trainingLoad.daysSinceLastSession}
          />
        </div>
      </section>

      {/* Evolution chart (F7) */}
      <section>
        <SectionHeader title="Evolución por distancia" />
        <EvolutionChart data={data.evolution} />
      </section>

      {/* Consistency + volume side by side on wide screens — shortens the
          scroll and lets both signals be read at a glance. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeader title="Evolución de consistencia" />
          <ConsistencyChart data={data.consistencyTrend} />
        </section>
        <section>
          <SectionHeader title="Volumen de entrenamiento" />
          <WeeklyVolumeChart data={data.trainingLoad.weekly} />
        </section>
      </div>

      {/* Recent sessions */}
      <section>
        <SectionHeader title="Últimas sesiones" />
        {data.recentSessions.length === 0 ? (
          <EmptyState
            title="Sin sesiones registradas"
            description="En cuanto tu coach o tú registren la primera sesión, aparecerá aquí."
          />
        ) : (
          <div className="space-y-2">
            {data.recentSessions.map((s) => (
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

      {/* Recent observations */}
      {data.recentObservations.length > 0 && (
        <section>
          <SectionHeader title="Observaciones recientes del coach" />
          <div className="space-y-2">
            {data.recentObservations.map((o) => (
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

      {/* Competitions (Fase 2.3) — athletes can self-register their own */}
      <section id="historial">
        <SectionHeader
          title="Mi historial competitivo"
          description={
            competitions.length > 0
              ? `${competitions.length} registro${
                  competitions.length === 1 ? '' : 's'
                }`
              : undefined
          }
        />
        {/* Collapsed by default: the common case here is consulting the
            history, not registering — the open form pushed the list far
            down the page. Native <details>, no client JS. */}
        <details className="group mb-3 rounded-xl border bg-card shadow-card">
          <summary className="flex cursor-pointer items-center justify-between gap-3 p-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground transition hover:text-foreground">
            Registrar nueva competición
            <ChevronDown
              className="h-4 w-4 transition group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="border-t p-4">
            <CompetitionForm athleteId={athleteId} />
          </div>
        </details>
        <CompetitionList competitions={competitions} canEdit />
      </section>
    </div>
    </>
  );
}
