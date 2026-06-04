'use server';

import { Role } from '@prisma/client';
import { db } from '@/lib/db';
import { requireRole, canManageClub } from '@/lib/rbac';
import { stddev } from '@/lib/analytics/consistency';
import {
  acwr,
  daysSinceLastSession,
  startOfIsoWeekUTC,
  addDaysUTC,
  type AcwrZone
} from '@/lib/analytics/training-load';
import { runCoachingEngine } from '@/lib/coaching/engine';
import type {
  AthleteCoachingContext,
  Audience,
  Tip
} from '@/lib/coaching/types';

// ── Helpers ─────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function roundOrNull(n: number | null, digits = 2): number | null {
  if (n === null) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * Builds the coaching context for one athlete from primary sources.
 * One Prisma round-trip per concern (arrows, sessions, attendance,
 * observations) executed in parallel via Promise.all.
 */
async function buildAthleteContext(athleteId: string): Promise<AthleteCoachingContext | null> {
  const athlete = await db.athlete.findUnique({
    where: { id: athleteId },
    select: { id: true, firstName: true, lastName: true, active: true }
  });
  if (!athlete?.active) return null;

  const now = new Date();
  const thirtyAgo = daysAgo(30);
  const sixtyAgo = daysAgo(60);
  const fourteenAgo = daysAgo(14);

  const [arrowsRaw, sessions30d, attendance, lastObservation, lastSession30dList] =
    await Promise.all([
      db.arrow.findMany({
        where: {
          isMiss: false,
          scoreSet: {
            session: { athleteId, date: { gte: sixtyAgo } }
          }
        },
        select: {
          score: true,
          scoreSet: { select: { session: { select: { date: true } } } }
        }
      }),
      db.trainingSession.findMany({
        where: { athleteId, date: { gte: thirtyAgo } },
        orderBy: { date: 'desc' },
        select: {
          id: true,
          date: true,
          scoreSets: {
            select: {
              arrows: {
                where: { isMiss: false },
                select: { score: true }
              }
            }
          }
        }
      }),
      db.attendance.groupBy({
        by: ['status'],
        where: { athleteId },
        _count: { _all: true }
      }),
      db.coachObservation.findFirst({
        where: { session: { athleteId } },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      }),
      db.trainingSession.findMany({
        where: { athleteId, date: { gte: fourteenAgo } },
        orderBy: { date: 'desc' },
        take: 1,
        select: { date: true }
      })
    ]);

  // Split arrows into 30-day and prev-30-day windows.
  const last30Scores: number[] = [];
  const prev30Scores: number[] = [];
  for (const a of arrowsRaw) {
    const d = a.scoreSet.session.date;
    if (d >= thirtyAgo) last30Scores.push(a.score);
    else prev30Scores.push(a.score);
  }

  // ACWR runs off SessionPoint[]. Build it from sessions30d + arrowsRaw.
  // Easier: aggregate arrows-per-session via the raw set.
  const sessionArrowMap = new Map<string, number>();
  for (const s of sessions30d) {
    let count = 0;
    for (const ss of s.scoreSets) count += ss.arrows.length;
    sessionArrowMap.set(s.date.toISOString() + ':' + s.id, count);
  }
  const sessionPoints = sessions30d.map((s) => ({
    date: s.date,
    arrowsCount: sessionArrowMap.get(s.date.toISOString() + ':' + s.id) ?? 0
  }));
  const acwrResult = acwr(sessionPoints, now);
  const dsls = daysSinceLastSession(sessionPoints, now);

  // Best round = highest single-session total in the last 30 days.
  let bestRoundLast30: number | null = null;
  for (const s of sessions30d) {
    let total = 0;
    for (const ss of s.scoreSets) {
      for (const a of ss.arrows) total += a.score;
    }
    if (bestRoundLast30 === null || total > bestRoundLast30) {
      bestRoundLast30 = total;
    }
  }

  // Weekly volume (this ISO week vs previous, by arrow count).
  const weekStart = startOfIsoWeekUTC(now);
  const prevWeekStart = addDaysUTC(weekStart, -7);
  let arrowsThisWeek = 0;
  let arrowsPrevWeek = 0;
  for (const a of arrowsRaw) {
    const d = a.scoreSet.session.date;
    if (d >= weekStart) arrowsThisWeek++;
    else if (d >= prevWeekStart) arrowsPrevWeek++;
  }

  // Attendance %.
  let presentCount = 0;
  let totalAttendance = 0;
  for (const row of attendance) {
    totalAttendance += row._count._all;
    if (row.status === 'PRESENT') presentCount += row._count._all;
  }
  const attendancePct =
    totalAttendance > 0
      ? Math.round((presentCount / totalAttendance) * 100)
      : null;

  return {
    athleteId: athlete.id,
    athleteName: `${athlete.firstName} ${athlete.lastName}`,
    arrowsLast30: last30Scores.length,
    arrowsPrev30: prev30Scores.length,
    sessionsLast30: sessions30d.length,
    daysSinceLastSession: dsls,
    avgLast30: roundOrNull(avg(last30Scores), 2),
    avgPrev30: roundOrNull(avg(prev30Scores), 2),
    bestRoundLast30,
    stddevLast30: roundOrNull(stddev(last30Scores), 2),
    stddevPrev30: roundOrNull(stddev(prev30Scores), 2),
    acwrZone: acwrResult.zone,
    acwrRatio: acwrResult.ratio,
    attendancePct,
    lastObservationAt: lastObservation?.createdAt ?? null,
    arrowsThisWeek,
    arrowsPrevWeek
  };
}

// ── Public actions ──────────────────────────────────────────────────────

/**
 * Tips for a single athlete. The athlete (ATHLETE role) can only ask
 * for their own; staff can ask for any athlete in their club.
 */
export async function getAthleteCoachingTips(
  athleteId: string,
  audience: Audience
): Promise<Tip[]> {
  const session = await requireRole([
    Role.ATHLETE,
    Role.COACH,
    Role.CLUB_ADMIN,
    Role.SUPER_ADMIN
  ]);

  const athlete = await db.athlete.findUnique({
    where: { id: athleteId },
    select: { id: true, userId: true, clubId: true, active: true }
  });
  if (!athlete?.active) return [];

  if (session.user.role === Role.ATHLETE) {
    if (athlete.userId !== session.user.id) return [];
  } else if (
    !canManageClub(session.user.role, session.user.clubId, athlete.clubId)
  ) {
    return [];
  }

  const ctx = await buildAthleteContext(athleteId);
  if (!ctx) return [];
  // `/deportistas/[id]` wants the full list, the others top 3.
  return runCoachingEngine(ctx, { audience, topN: 3 });
}

export type ClubCoachingRow = {
  athleteId: string;
  athleteName: string;
  topTip: Tip;
};

/**
 * Club view: returns one top tip per athlete who has something
 * actionable for the coach. Ordered by severity. Used by /equipo.
 */
export async function getClubCoachingTips(): Promise<ClubCoachingRow[]> {
  const session = await requireRole([
    Role.COACH,
    Role.CLUB_ADMIN,
    Role.SUPER_ADMIN
  ]);
  const clubId = session.user.clubId;

  const athletes = await db.athlete.findMany({
    where: { ...(clubId ? { clubId } : {}), active: true },
    select: { id: true }
  });

  const ctxs = await Promise.all(
    athletes.map((a) => buildAthleteContext(a.id))
  );

  const rows: ClubCoachingRow[] = [];
  for (const ctx of ctxs) {
    if (!ctx) continue;
    const tips = runCoachingEngine(ctx, { audience: 'coach', topN: 1 });
    if (tips.length === 0) continue;
    rows.push({
      athleteId: ctx.athleteId,
      athleteName: ctx.athleteName,
      topTip: tips[0]
    });
  }

  // Severity order: warn (0) → suggest (1) → info (2).
  const sev = (t: Tip): number =>
    t.severity === 'warn' ? 0 : t.severity === 'suggest' ? 1 : 2;
  rows.sort((a, b) => sev(a.topTip) - sev(b.topTip));
  return rows;
}

/**
 * Session-close tips: for the athlete who just finished, compare the
 * session against their 30-day baseline. Returns 1-2 tips.
 */
export async function getSessionCoachingTips(sessionId: string): Promise<Tip[]> {
  const session = await requireRole([
    Role.ATHLETE,
    Role.COACH,
    Role.CLUB_ADMIN,
    Role.SUPER_ADMIN
  ]);

  const ts = await db.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      athleteId: true,
      athlete: { select: { clubId: true, userId: true } },
      scoreSets: {
        select: {
          arrows: {
            where: { isMiss: false },
            select: { score: true }
          }
        }
      }
    }
  });
  if (!ts) return [];

  if (session.user.role === Role.ATHLETE) {
    if (ts.athlete.userId !== session.user.id) return [];
  } else if (
    !canManageClub(session.user.role, session.user.clubId, ts.athlete.clubId)
  ) {
    return [];
  }

  const ctx = await buildAthleteContext(ts.athleteId);
  if (!ctx) return [];

  // Enrich with the just-finished session.
  const scores: number[] = [];
  let sessionTotal = 0;
  for (const ss of ts.scoreSets) {
    for (const a of ss.arrows) {
      scores.push(a.score);
      sessionTotal += a.score;
    }
  }
  const sessionAvg = avg(scores);
  const isNewBest =
    ctx.bestRoundLast30 !== null && sessionTotal >= ctx.bestRoundLast30;

  const enriched: AthleteCoachingContext = {
    ...ctx,
    lastSession: {
      sessionId,
      avgScore: sessionAvg,
      arrowsCount: scores.length,
      isNewBestRound: isNewBest
    }
  };

  return runCoachingEngine(enriched, {
    audience: 'athlete',
    topN: 2,
    onlyKeys: ['session.aboveAvg', 'session.belowAvg', 'evolution.bestRound']
  });
}

// Re-export for compile-time consumers (UI components).
export type { AcwrZone };
