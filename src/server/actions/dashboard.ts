'use server';

import { Role } from '@prisma/client';
import { db } from '@/lib/db';
import { canManageClub, requireRole } from '@/lib/rbac';
import { stddev } from '@/lib/analytics/consistency';
import {
  acwr,
  daysSinceLastSession,
  weeklyAggregates,
  type Acwr,
  type SessionPoint,
  type WeeklyAgg
} from '@/lib/analytics/training-load';
import {
  clubWeeklyTrend,
  type SessionPointForTrend,
  type WeeklyClubAgg
} from '@/lib/analytics/team-aggregate';
import {
  computeSessionCaptureStatus,
  type SessionCaptureStatus
} from '@/lib/analytics/session-status';
import type { SessionType } from '@prisma/client';

// ── Helpers ──────────────────────────────────────────────────────────────────

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function avgArr(scores: number[]) {
  if (!scores.length) return null;
  return scores.reduce((s, v) => s + v, 0) / scores.length;
}

function roundOrNull(n: number | null, decimals = 2): number | null {
  if (n === null) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

// ── F5: Athlete dashboard ─────────────────────────────────────────────────────

export type AthleteDashboardData = {
  athlete: {
    id: string;
    firstName: string;
    lastName: string;
    bowModality: string;
    category: string;
  };
  kpis: {
    avgLast30: number | null;
    bestRound: number | null;
    arrowsThisMonth: number;
    sessionsThisMonth: number;
    // Sample stddev of every valid arrow shot in the last 30 days.
    // Lower = more consistent. `null` if <2 arrows in the window.
    stddevLast30: number | null;
    // Same metric for the previous 30-day window (30–60 days ago).
    // Used to compute the delta indicator in the UI.
    stddevPrev30: number | null;
  };
  recentSessions: Array<{
    id: string;
    date: Date;
    type: string;
    indoor: boolean;
    total: number;
    distanceSummary: string;
    // Per-session stddev across all valid arrows in this session, all
    // distances combined. `null` if the session has <2 valid arrows.
    stddev: number | null;
  }>;
  recentObservations: Array<{
    id: string;
    content: string;
    createdAt: Date;
    editableUntil: Date;
    coachName: string;
    tags: Array<{ id: string; name: string }>;
    sessionId: string;
  }>;
  evolution: Array<{
    sessionId: string;
    date: Date;
    distance: number;
    avg: number;
  }>;
  // Per-session consistency over time, used for the "Consistencia"
  // line chart. Ordered chronologically (oldest first), latest 20 sessions.
  consistencyTrend: Array<{
    sessionId: string;
    date: Date;
    stddev: number | null;
    arrowsCount: number;
  }>;
  // Training load (Fase 2.2): weekly volume window + ACWR snapshot.
  trainingLoad: {
    weekly: WeeklyAgg[]; // last 12 weeks, chronological
    acwr: Acwr;
    daysSinceLastSession: number | null;
  };
};

export async function getAthleteDashboard(
  athleteId: string
): Promise<AthleteDashboardData | null> {
  await requireRole([Role.COACH, Role.CLUB_ADMIN, Role.SUPER_ADMIN, Role.ATHLETE]);

  const athlete = await db.athlete.findUnique({
    where: { id: athleteId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      bowModality: { select: { name: true } },
      category: { select: { name: true } }
    }
  });
  if (!athlete) return null;

  const thirtyAgo = daysAgo(30);
  const sixtyAgo = daysAgo(60);
  const mStart = monthStart();

  // Run independent queries in parallel
  const [
    arrowsLast60,
    arrowsThisMonth,
    sessionsThisMonth,
    last5,
    allSessionsRaw,
    observationsRaw
  ] = await Promise.all([
    // Raw scores for last 60 days — we'll bucket into last30 / prev30
    // and use them for stddev (which needs the full distribution, not
    // just the aggregate).
    db.arrow.findMany({
      where: {
        isMiss: false,
        scoreSet: { session: { athleteId, date: { gte: sixtyAgo } } }
      },
      select: {
        score: true,
        scoreSet: { select: { session: { select: { date: true } } } }
      }
    }),
      // Arrows this month
      db.arrow.count({
        where: {
          isMiss: false,
          scoreSet: { session: { athleteId, date: { gte: mStart } } }
        }
      }),
      // Sessions this month
      db.trainingSession.count({ where: { athleteId, date: { gte: mStart } } }),
      // Last 5 sessions with score totals
      db.trainingSession.findMany({
        where: { athleteId },
        orderBy: { date: 'desc' },
        take: 5,
        select: {
          id: true,
          date: true,
          type: true,
          indoor: true,
          scoreSets: {
            select: {
              distance: true,
              arrows: { where: { isMiss: false }, select: { score: true } }
            }
          }
        }
      }),
      // All sessions for best round + evolution + training load.
      // `_count.arrows` includes misses (training load counts every
      // arrow shot regardless of result); the filtered `arrows` array
      // is used by the score-based analytics.
      db.trainingSession.findMany({
        where: { athleteId },
        orderBy: { date: 'asc' },
        select: {
          id: true,
          date: true,
          scoreSets: {
            select: {
              distance: true,
              arrows: { where: { isMiss: false }, select: { score: true } },
              _count: { select: { arrows: true } }
            }
          }
        }
      }),
      // Recent observations (through sessions)
      db.coachObservation.findMany({
        where: { session: { athleteId } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          content: true,
          createdAt: true,
          editableUntil: true,
          sessionId: true,
          coach: { select: { firstName: true, lastName: true } },
          tags: { select: { id: true, name: true } }
        }
      })
    ]);

  // Split the last-60-days arrows into the two analytical windows.
  const last30Scores: number[] = [];
  const prev30Scores: number[] = [];
  for (const a of arrowsLast60) {
    if (a.scoreSet.session.date >= thirtyAgo) last30Scores.push(a.score);
    else prev30Scores.push(a.score);
  }
  const avgLast30 = avgArr(last30Scores);
  const stddevLast30 = stddev(last30Scores);
  const stddevPrev30 = stddev(prev30Scores);

  // Best round: session with max total score across all score sets
  let bestRound: number | null = null;
  for (const s of allSessionsRaw) {
    const total = s.scoreSets.flatMap((ss) => ss.arrows).reduce((sum, a) => sum + a.score, 0);
    if (total > (bestRound ?? -1)) bestRound = total;
  }
  if (bestRound === 0) bestRound = null;

  // Evolution: one point per (session, distance)
  const evolution: AthleteDashboardData['evolution'] = [];
  for (const s of allSessionsRaw) {
    for (const ss of s.scoreSets) {
      const scores = ss.arrows.map((a) => a.score);
      const avg = avgArr(scores);
      if (avg !== null) {
        evolution.push({ sessionId: s.id, date: s.date, distance: ss.distance, avg });
      }
    }
  }

  // Recent sessions with totals + per-session stddev.
  const recentSessions = last5.map((s) => {
    const flatScores = s.scoreSets.flatMap((ss) => ss.arrows.map((a) => a.score));
    const total = flatScores.reduce((sum, v) => sum + v, 0);
    const distances = s.scoreSets.map((ss) => `${ss.distance}m`).join(', ');
    return {
      id: s.id,
      date: s.date,
      type: s.type,
      indoor: s.indoor,
      total,
      distanceSummary: distances || '—',
      stddev: roundOrNull(stddev(flatScores), 2)
    };
  });

  // Consistency trend: per-session stddev across all valid arrows,
  // chronological (oldest → newest), latest 20 sessions.
  const consistencyTrend: AthleteDashboardData['consistencyTrend'] = [];
  for (const s of allSessionsRaw) {
    const flatScores = s.scoreSets.flatMap((ss) => ss.arrows.map((a) => a.score));
    if (flatScores.length === 0) continue;
    consistencyTrend.push({
      sessionId: s.id,
      date: s.date,
      stddev: roundOrNull(stddev(flatScores), 2),
      arrowsCount: flatScores.length
    });
  }
  const trimmedTrend = consistencyTrend.slice(-20);

  // Training load (Fase 2.2): build SessionPoints from the full history,
  // then let the analytics utils filter by window.
  const sessionPoints: SessionPoint[] = allSessionsRaw.map((s) => ({
    date: s.date,
    arrowsCount: s.scoreSets.reduce((sum, ss) => sum + ss._count.arrows, 0)
  }));
  const trainingLoad: AthleteDashboardData['trainingLoad'] = {
    weekly: weeklyAggregates(sessionPoints, 12),
    acwr: acwr(sessionPoints),
    daysSinceLastSession: daysSinceLastSession(sessionPoints)
  };

  return {
    athlete: {
      id: athlete.id,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      bowModality: athlete.bowModality.name,
      category: athlete.category.name
    },
    kpis: {
      avgLast30: avgLast30 !== null ? Number(avgLast30.toFixed(1)) : null,
      bestRound,
      arrowsThisMonth,
      sessionsThisMonth,
      stddevLast30: roundOrNull(stddevLast30, 2),
      stddevPrev30: roundOrNull(stddevPrev30, 2)
    },
    recentSessions,
    evolution,
    recentObservations: observationsRaw.map((o) => ({
      ...o,
      coachName: `${o.coach.firstName} ${o.coach.lastName}`
    })),
    consistencyTrend: trimmedTrend,
    trainingLoad
  };
}

// ── F6: Coach/admin team dashboard ───────────────────────────────────────────

export type TeamAthlete = {
  id: string;
  firstName: string;
  lastName: string;
  bowModality: string;
  category: string;
  lastSessionDate: Date | null;
  avgLast30: number | null;
  avgPrev30: number | null;
  delta: number | null;
  attendancePct: number | null;
  alert: 'none' | 'inactive' | 'drop';
  // Added in Fase 5.1 — used by ClubSummary aggregate.
  stddevLast30: number | null;
  acwrZone: Acwr['zone'];
  arrowsLast30: number;
  sessionsLast30: number;
};

export async function getTeamDashboard(): Promise<TeamAthlete[]> {
  const session = await requireRole([Role.COACH, Role.CLUB_ADMIN, Role.SUPER_ADMIN]);

  const clubId = session.user.clubId;

  const athletes = await db.athlete.findMany({
    where: {
      ...(clubId ? { clubId } : {}),
      active: true
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      bowModality: { select: { name: true } },
      category: { select: { name: true } },
      sessions: {
        orderBy: { date: 'desc' },
        take: 1,
        select: { date: true }
      }
    }
  });

  if (!athletes.length) return [];

  const athleteIds = athletes.map((a) => a.id);
  const thirtyAgo = daysAgo(30);
  const sixtyAgo = daysAgo(60);
  const sevenAgo = daysAgo(7);

  // Load arrows for last 60 days (for both avg windows + ACWR proxy).
  const arrowsRaw = await db.arrow.findMany({
    where: {
      isMiss: false,
      scoreSet: {
        session: {
          athleteId: { in: athleteIds },
          date: { gte: sixtyAgo }
        }
      }
    },
    select: {
      score: true,
      scoreSet: {
        select: {
          session: {
            select: { athleteId: true, date: true }
          }
        }
      }
    }
  });

  // Load attendance (all time — compute % from existing records).
  const attendanceRaw = await db.attendance.groupBy({
    by: ['athleteId', 'status'],
    where: { athleteId: { in: athleteIds } },
    _count: { _all: true }
  });

  // Sessions count in the last 30d per athlete (for club summary).
  const sessionsLast30Raw = await db.trainingSession.groupBy({
    by: ['athleteId'],
    where: { athleteId: { in: athleteIds }, date: { gte: thirtyAgo } },
    _count: { _all: true }
  });
  const sessionsLast30ByAthlete = new Map(
    sessionsLast30Raw.map((s) => [s.athleteId, s._count._all])
  );

  // Index arrows by athlete + window. We also bucket by ACWR windows
  // (last 7d acute, last 28d chronic) using non-miss arrow counts as a
  // proxy for total volume — slightly underestimates vs the per-athlete
  // dashboard (which includes misses) but consistent enough for a
  // team-level zone breakdown.
  type Buckets = {
    last30: number[];
    prev30: number[];
    acuteCount: number;
    chronicCount: number;
  };
  const arrowsByAthlete: Record<string, Buckets> = {};
  const acwrCutoff = daysAgo(28);
  for (const a of arrowsRaw) {
    const aid = a.scoreSet.session.athleteId;
    const date = a.scoreSet.session.date;
    if (!arrowsByAthlete[aid]) {
      arrowsByAthlete[aid] = {
        last30: [],
        prev30: [],
        acuteCount: 0,
        chronicCount: 0
      };
    }
    if (date >= thirtyAgo) {
      arrowsByAthlete[aid].last30.push(a.score);
    } else {
      arrowsByAthlete[aid].prev30.push(a.score);
    }
    if (date >= acwrCutoff) {
      arrowsByAthlete[aid].chronicCount++;
      if (date >= sevenAgo) arrowsByAthlete[aid].acuteCount++;
    }
  }

  function classifyZone(buckets: Buckets): Acwr['zone'] {
    const chronicPerWeek = buckets.chronicCount / 4;
    if (chronicPerWeek === 0) {
      return buckets.acuteCount > 0 ? 'low' : 'inactive';
    }
    const ratio = buckets.acuteCount / chronicPerWeek;
    if (ratio < 0.8) return 'low';
    if (ratio <= 1.3) return 'optimal';
    if (ratio <= 1.5) return 'caution';
    return 'overload';
  }

  // Index attendance by athlete
  const attendanceByAthlete: Record<string, { present: number; total: number }> = {};
  for (const r of attendanceRaw) {
    if (!attendanceByAthlete[r.athleteId]) {
      attendanceByAthlete[r.athleteId] = { present: 0, total: 0 };
    }
    attendanceByAthlete[r.athleteId].total += r._count._all;
    if (r.status === 'PRESENT') {
      attendanceByAthlete[r.athleteId].present += r._count._all;
    }
  }

  const now = new Date();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

  return athletes.map((a) => {
    const lastSessionDate = a.sessions[0]?.date ?? null;
    const arrows =
      arrowsByAthlete[a.id] ??
      ({ last30: [], prev30: [], acuteCount: 0, chronicCount: 0 } as const);
    const avgLast30 = avgArr(arrows.last30);
    const avgPrev30 = avgArr(arrows.prev30);
    const delta =
      avgLast30 !== null && avgPrev30 !== null
        ? Number((avgLast30 - avgPrev30).toFixed(2))
        : null;
    const sd = stddev(arrows.last30);
    const stddevLast30Rounded = sd !== null ? Number(sd.toFixed(2)) : null;
    const acwrZone = classifyZone({
      last30: arrows.last30,
      prev30: arrows.prev30,
      acuteCount: arrows.acuteCount,
      chronicCount: arrows.chronicCount
    });

    const att = attendanceByAthlete[a.id];
    const attendancePct = att
      ? Number(((att.present / att.total) * 100).toFixed(0))
      : null;

    const inactive =
      !lastSessionDate || now.getTime() - lastSessionDate.getTime() > fourteenDaysMs;
    const dropped = delta !== null && delta < -1.0;

    const alert: TeamAthlete['alert'] = inactive
      ? 'inactive'
      : dropped
        ? 'drop'
        : 'none';

    return {
      id: a.id,
      firstName: a.firstName,
      lastName: a.lastName,
      bowModality: a.bowModality.name,
      category: a.category.name,
      lastSessionDate,
      avgLast30: avgLast30 !== null ? Number(avgLast30.toFixed(1)) : null,
      avgPrev30: avgPrev30 !== null ? Number(avgPrev30.toFixed(1)) : null,
      delta,
      attendancePct,
      alert,
      stddevLast30: stddevLast30Rounded,
      acwrZone,
      arrowsLast30: arrows.last30.length,
      sessionsLast30: sessionsLast30ByAthlete.get(a.id) ?? 0
    };
  });
}

// ── Fase 5.2: Club trend (weekly aggregates across all athletes) ──────────────

/**
 * Weekly trend of arrows + arrow-weighted average across the entire
 * club. Returns one `WeeklyClubAgg` per week in the trailing window so
 * the chart can render even when most weeks are empty.
 *
 * One arrow query (capped to the requested window) — agregated by
 * session in JS; no schema changes, no impact on `getTeamDashboard`.
 */
export async function getClubTrend(weeks = 12): Promise<WeeklyClubAgg[]> {
  const session = await requireRole([Role.COACH, Role.CLUB_ADMIN, Role.SUPER_ADMIN]);
  const clubId = session.user.clubId;

  const clubAthletes = await db.athlete.findMany({
    where: { ...(clubId ? { clubId } : {}), active: true },
    select: { id: true }
  });
  if (clubAthletes.length === 0) {
    return clubWeeklyTrend([], weeks);
  }
  const athleteIds = clubAthletes.map((a) => a.id);

  const windowStart = daysAgo(weeks * 7);
  const arrows = await db.arrow.findMany({
    where: {
      isMiss: false,
      scoreSet: {
        session: {
          athleteId: { in: athleteIds },
          date: { gte: windowStart }
        }
      }
    },
    select: {
      score: true,
      scoreSet: {
        select: {
          session: { select: { id: true, date: true, athleteId: true } }
        }
      }
    }
  });

  type Acc = { date: Date; athleteId: string; arrows: number; sumScore: number };
  const bySession = new Map<string, Acc>();
  for (const a of arrows) {
    const sess = a.scoreSet.session;
    const existing = bySession.get(sess.id);
    if (existing) {
      existing.arrows += 1;
      existing.sumScore += a.score;
    } else {
      bySession.set(sess.id, {
        date: sess.date,
        athleteId: sess.athleteId,
        arrows: 1,
        sumScore: a.score
      });
    }
  }

  const points: SessionPointForTrend[] = Array.from(bySession.values());
  return clubWeeklyTrend(points, weeks);
}

// ── Fase 5.3: Athlete upcoming sessions ──────────────────────────────────────

export type UpcomingSession = {
  id: string;
  date: Date;
  type: SessionType;
  indoor: boolean;
  distanceSummary: string;
  expectedArrows: number;
  capturedArrows: number;
  status: SessionCaptureStatus;
};

const DAY_MS_UP = 24 * 60 * 60 * 1000;

/**
 * Sessions in the athlete's ±2-day window that still deserve a CTA on
 * /mi-progreso: anything not-yet-captured, plus future sessions even
 * when empty. Past sessions that are fully captured drop off — they
 * already live in "Últimas sesiones".
 *
 * Ownership: an ATHLETE can only resolve their own athleteId; staff can
 * resolve any athlete in their club.
 */
export async function getAthleteUpcomingSessions(
  athleteId: string
): Promise<UpcomingSession[]> {
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

  const now = new Date();
  const startWindow = new Date(now.getTime() - 2 * DAY_MS_UP);
  startWindow.setHours(0, 0, 0, 0);
  const endWindow = new Date(now.getTime() + 2 * DAY_MS_UP);
  endWindow.setHours(23, 59, 59, 999);

  const rows = await db.trainingSession.findMany({
    where: { athleteId, date: { gte: startWindow, lte: endWindow } },
    orderBy: { date: 'asc' },
    select: {
      id: true,
      date: true,
      type: true,
      indoor: true,
      scoreSets: {
        select: {
          endsCount: true,
          arrowsPerEnd: true,
          _count: { select: { arrows: true } },
          distance: true
        },
        orderBy: { distance: 'asc' }
      }
    }
  });

  const upcoming: UpcomingSession[] = [];
  for (const r of rows) {
    let expected = 0;
    let captured = 0;
    for (const s of r.scoreSets) {
      expected += s.endsCount * s.arrowsPerEnd;
      captured += s._count.arrows;
    }
    const status = computeSessionCaptureStatus(expected, captured);
    const isPast = r.date < new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (isPast && status === 'complete') continue;

    const distanceSummary = r.scoreSets.map((s) => `${s.distance}m`).join(' · ');

    upcoming.push({
      id: r.id,
      date: r.date,
      type: r.type,
      indoor: r.indoor,
      distanceSummary: distanceSummary || '—',
      expectedArrows: expected,
      capturedArrows: captured,
      status
    });
  }

  return upcoming;
}
