import { Role } from '@prisma/client';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { canManageClub } from '@/lib/rbac';

export type SessionRow = {
  sessionId: string;
  date: Date;
  type: string;
  indoor: boolean;
  distance: number;
  arrowsCount: number;
  xCount: number;
  total: number;
  avg: number | null;
};

export type ObservationRow = {
  id: string;
  createdAt: Date;
  coachName: string;
  content: string;
  tags: string[];
};

export type AthleteReport = {
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    documentId: string;
    bowModality: string;
    category: string;
    clubName: string;
    coachName: string | null;
  };
  periodFrom: Date | null;
  periodTo: Date | null;
  sessions: SessionRow[];
  observations: ObservationRow[];
  totals: {
    sessionCount: number;
    arrowsCount: number;
    xCount: number;
    totalScore: number;
    avgPerArrow: number | null;
  };
};

export type ReportAuthError =
  | { kind: 'unauthenticated' }
  | { kind: 'not-found' }
  | { kind: 'forbidden' };

export type ReportResult =
  | { ok: true; data: AthleteReport }
  | { ok: false; error: ReportAuthError };

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Fetches all data needed to render a CSV or PDF report for an athlete.
 * Default window: last 365 days. Caller may override by passing fromDate.
 *
 * RBAC:
 *  - ATHLETE: only own report (athlete.userId === session.user.id)
 *  - COACH / CLUB_ADMIN: only athletes in their club
 *  - SUPER_ADMIN: any
 */
export async function getAthleteReport(
  athleteId: string,
  options?: { fromDate?: Date }
): Promise<ReportResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: { kind: 'unauthenticated' } };

  const athlete = await db.athlete.findUnique({
    where: { id: athleteId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      documentId: true,
      userId: true,
      clubId: true,
      bowModality: { select: { name: true } },
      category: { select: { name: true } },
      club: { select: { name: true } },
      coach: { select: { firstName: true, lastName: true } }
    }
  });
  if (!athlete) return { ok: false, error: { kind: 'not-found' } };

  if (session.user.role === Role.ATHLETE) {
    if (athlete.userId !== session.user.id) {
      return { ok: false, error: { kind: 'forbidden' } };
    }
  } else if (
    !canManageClub(session.user.role, session.user.clubId, athlete.clubId)
  ) {
    return { ok: false, error: { kind: 'forbidden' } };
  }

  const fromDate = options?.fromDate ?? new Date(Date.now() - ONE_YEAR_MS);

  const [trainingSessions, observations] = await Promise.all([
    db.trainingSession.findMany({
      where: { athleteId, date: { gte: fromDate } },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        type: true,
        indoor: true,
        scoreSets: {
          select: {
            distance: true,
            arrows: { select: { score: true, isX: true, isMiss: true } }
          }
        }
      }
    }),
    db.coachObservation.findMany({
      where: { session: { athleteId, date: { gte: fromDate } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        content: true,
        createdAt: true,
        coach: { select: { firstName: true, lastName: true } },
        tags: { select: { name: true } }
      }
    })
  ]);

  const sessions: SessionRow[] = [];
  for (const s of trainingSessions) {
    for (const ss of s.scoreSets) {
      const valid = ss.arrows.filter((a) => !a.isMiss);
      const total = valid.reduce((sum, a) => sum + a.score, 0);
      const xCount = ss.arrows.filter((a) => a.isX).length;
      sessions.push({
        sessionId: s.id,
        date: s.date,
        type: s.type,
        indoor: s.indoor,
        distance: ss.distance,
        arrowsCount: ss.arrows.length,
        xCount,
        total,
        avg: valid.length ? total / valid.length : null
      });
    }
  }

  const totals = {
    sessionCount: trainingSessions.length,
    arrowsCount: sessions.reduce((a, s) => a + s.arrowsCount, 0),
    xCount: sessions.reduce((a, s) => a + s.xCount, 0),
    totalScore: sessions.reduce((a, s) => a + s.total, 0),
    avgPerArrow: null as number | null
  };
  const validArrowsCount = sessions.reduce(
    (a, s) => a + (s.avg !== null ? s.arrowsCount : 0),
    0
  );
  totals.avgPerArrow = validArrowsCount
    ? totals.totalScore / validArrowsCount
    : null;

  return {
    ok: true,
    data: {
      athlete: {
        id: athlete.id,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        documentId: athlete.documentId,
        bowModality: athlete.bowModality.name,
        category: athlete.category.name,
        clubName: athlete.club.name,
        coachName: athlete.coach
          ? `${athlete.coach.firstName} ${athlete.coach.lastName}`
          : null
      },
      periodFrom: fromDate,
      periodTo: new Date(),
      sessions,
      observations: observations.map((o) => ({
        id: o.id,
        createdAt: o.createdAt,
        content: o.content,
        coachName: `${o.coach.firstName} ${o.coach.lastName}`,
        tags: o.tags.map((t) => t.name)
      })),
      totals
    }
  };
}
