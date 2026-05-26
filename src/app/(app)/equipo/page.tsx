import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { auth } from '@/lib/auth';
import { getClubTrend, getTeamDashboard } from '@/server/actions/dashboard';
import { clubSummary } from '@/lib/analytics/team-aggregate';
import { ClubTrendChart } from '@/components/team/ClubTrendChart';
import { TeamRoster } from '@/components/team/TeamRoster';
import { TeamSummaryBand } from '@/components/team/TeamSummaryBand';
import { ArrowJourneyBackground } from '@/components/decor/ArrowJourneyBackground';
import { PageHeader, SectionHeader } from '@/components/ui/page-header';

export default async function EquipoPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const role = session.user.role;
  const isStaff =
    role === Role.COACH || role === Role.CLUB_ADMIN || role === Role.SUPER_ADMIN;

  if (!isStaff) redirect('/mi-progreso');

  const [athletes, trend] = await Promise.all([
    getTeamDashboard(),
    getClubTrend(12)
  ]);

  const count = athletes.length;
  const plural = count === 1 ? '' : 's';
  const description =
    count > 0
      ? `${count} deportista${plural} activo${plural}`
      : 'Aún no tienes deportistas asignados';

  // Pure JS aggregate — no extra DB round-trip.
  const summary = clubSummary(
    athletes.map((a) => ({
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      avgLast30: a.avgLast30,
      avgPrev30: a.avgPrev30,
      stddevLast30: a.stddevLast30,
      arrowsLast30: a.arrowsLast30,
      sessionsLast30: a.sessionsLast30,
      acwrZone: a.acwrZone
    }))
  );

  return (
    <>
      <ArrowJourneyBackground />
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vista del coach"
          title="Mi Equipo"
          description={description}
        />
        {count > 0 && <TeamSummaryBand summary={summary} />}
        {count > 0 && (
          <section>
            <SectionHeader
              title="Tendencia del club"
              description="Últimas 12 semanas"
            />
            <ClubTrendChart data={trend} />
          </section>
        )}
        <TeamRoster athletes={athletes} />
      </div>
    </>
  );
}
