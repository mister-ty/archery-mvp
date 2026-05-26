'use server';

import { Role } from '@prisma/client';
import { db } from '@/lib/db';
import { canManageClub, requireRole } from '@/lib/rbac';
import { stddev } from '@/lib/analytics/consistency';
import {
  acwr,
  daysSinceLastSession,
  type SessionPoint
} from '@/lib/analytics/training-load';

const MAX_COMPARE = 6;

export type CompareRow = {
  id: string;
  firstName: string;
  lastName: string;
  bowModality: string;
  category: string;
  avgLast30: number | null;
  stddevLast30: number | null;
  arrowsLast30: number;
  sessionsLast30: number;
  bestRound: number | null;
  acwrRatio: number | null;
  acwrZone: 'inactive' | 'low' | 'optimal' | 'caution' | 'overload';
  daysSinceLastSession: number | null;
  competitionsCount: number;
  bestCompetition: { name: string; date: Date; totalScore: number } | null;
};

/**
 * Side-by-side comparison of up to MAX_COMPARE athletes.
 * Order of the returned rows mirrors the order of the input IDs (after
 * permission filtering).
 *
 * RBAC:
 *   - SUPER_ADMIN: any athletes
 *   - COACH / CLUB_ADMIN: only athletes of their own club
 *   - ATHLETE: rejected (this page is for staff / coaches comparing peers)
 */
export async function compareAthletes(
  athleteIds: string[]
): Promise<CompareRow[]> {
  const session = await requireRole([
    Role.SUPER_ADMIN,
    Role.CLUB_ADMIN,
    Role.COACH
  ]);

  const unique = [...new Set(athleteIds)].filter(Boolean).slice(0, MAX_COMPARE);
  if (unique.length === 0) return [];

  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const athletes = await db.athlete.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      clubId: true,
      bowModality: { select: { name: true } },
      category: { select: { name: true } }
    }
  });

  // Filter by permissions, then preserve input order.
  const allowed = athletes.filter((a) =>
    canManageClub(session.user.role, session.user.clubId, a.clubId)
  );
  const allowedById = new Map(allowed.map((a) => [a.id, a]));
  const ordered = unique
    .map((id) => allowedById.get(id))
    .filter((a): a is (typeof allowed)[number] => Boolean(a));
  if (ordered.length === 0) return [];

  const orderedIds = ordered.map((a) => a.id);

  const [arrowsLast30, sessionsLast30, allSessions, competitionsAgg, bestComps] =
    await Promise.all([
      db.arrow.findMany({
        where: {
          isMiss: false,
          scoreSet: {
            session: {
              athleteId: { in: orderedIds },
              date: { gte: thirtyAgo }
            }
          }
        },
        select: {
          score: true,
          scoreSet: {
            select: { session: { select: { athleteId: true } } }
          }
        }
      }),
      db.trainingSession.groupBy({
        by: ['athleteId'],
        where: { athleteId: { in: orderedIds }, date: { gte: thirtyAgo } },
        _count: { _all: true }
      }),
      db.trainingSession.findMany({
        where: { athleteId: { in: orderedIds } },
        orderBy: { date: 'asc' },
        select: {
          athleteId: true,
          date: true,
          scoreSets: {
            select: {
              arrows: { where: { isMiss: false }, select: { score: true } },
              _count: { select: { arrows: true } }
            }
          }
        }
      }),
      db.competition.groupBy({
        by: ['athleteId'],
        where: { athleteId: { in: orderedIds } },
        _count: { _all: true }
      }),
      db.competition.findMany({
        where: { athleteId: { in: orderedIds } },
        orderBy: [{ totalScore: 'desc' }],
        select: { athleteId: true, name: true, date: true, totalScore: true }
      })
    ]);

  // Index helpers
  const arrowsByAthlete: Record<string, number[]> = {};
  for (const a of arrowsLast30) {
    const aid = a.scoreSet.session.athleteId;
    (arrowsByAthlete[aid] ??= []).push(a.score);
  }
  const sessionsCountById = new Map(
    sessionsLast30.map((s) => [s.athleteId, s._count._all])
  );
  const competitionsCountById = new Map(
    competitionsAgg.map((c) => [c.athleteId, c._count._all])
  );

  // Build per-athlete best round + ACWR inputs.
  const allByAthlete: Record<
    string,
    { sessionPoints: SessionPoint[]; bestRound: number }
  > = {};
  for (const s of allSessions) {
    const a = (allByAthlete[s.athleteId] ??= {
      sessionPoints: [],
      bestRound: 0
    });
    const validScores = s.scoreSets.flatMap((ss) =>
      ss.arrows.map((ar) => ar.score)
    );
    const total = validScores.reduce((sum, v) => sum + v, 0);
    if (total > a.bestRound) a.bestRound = total;
    a.sessionPoints.push({
      date: s.date,
      arrowsCount: s.scoreSets.reduce((sum, ss) => sum + ss._count.arrows, 0)
    });
  }

  // Best competition per athlete (first occurrence after orderBy desc).
  const bestCompByAthlete = new Map<
    string,
    { name: string; date: Date; totalScore: number }
  >();
  for (const c of bestComps) {
    if (!bestCompByAthlete.has(c.athleteId)) {
      bestCompByAthlete.set(c.athleteId, {
        name: c.name,
        date: c.date,
        totalScore: c.totalScore
      });
    }
  }

  return ordered.map((a) => {
    const last30 = arrowsByAthlete[a.id] ?? [];
    const avg =
      last30.length > 0
        ? Number((last30.reduce((s, v) => s + v, 0) / last30.length).toFixed(1))
        : null;
    const sd = stddev(last30);
    const sdRounded = sd !== null ? Number(sd.toFixed(2)) : null;
    const allForAthlete = allByAthlete[a.id] ?? {
      sessionPoints: [] as SessionPoint[],
      bestRound: 0
    };
    const acwrSnap = acwr(allForAthlete.sessionPoints);
    return {
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      bowModality: a.bowModality.name,
      category: a.category.name,
      avgLast30: avg,
      stddevLast30: sdRounded,
      arrowsLast30: last30.length,
      sessionsLast30: sessionsCountById.get(a.id) ?? 0,
      bestRound: allForAthlete.bestRound > 0 ? allForAthlete.bestRound : null,
      acwrRatio: acwrSnap.ratio,
      acwrZone: acwrSnap.zone,
      daysSinceLastSession: daysSinceLastSession(allForAthlete.sessionPoints),
      competitionsCount: competitionsCountById.get(a.id) ?? 0,
      bestCompetition: bestCompByAthlete.get(a.id) ?? null
    };
  });
}
