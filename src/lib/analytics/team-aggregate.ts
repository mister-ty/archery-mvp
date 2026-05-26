/**
 * Club-level aggregates derived from per-athlete dashboards.
 *
 * Pure: takes plain athlete summaries (whatever the server action chose
 * to pre-compute) and returns an aggregate snapshot for the coach view.
 * No DB / Prisma in here so tests can fixture-feed it freely.
 */

import { addDaysUTC, startOfIsoWeekUTC, type AcwrZone } from './training-load';

export type TeamAthleteSummary = {
  id: string;
  firstName: string;
  lastName: string;
  /** Avg per arrow over the last 30 days (null if no arrows). */
  avgLast30: number | null;
  /** Same metric for the 30 days BEFORE that — used to compute delta. */
  avgPrev30: number | null;
  /** Sample stddev of last-30d arrows. Lower = more consistent. */
  stddevLast30: number | null;
  /** Total non-miss arrows shot in the last 30 days. */
  arrowsLast30: number;
  /** Sessions in the last 30 days. */
  sessionsLast30: number;
  /** ACWR zone snapshot (see training-load.ts). */
  acwrZone: AcwrZone;
};

export type ZoneBreakdown = Record<AcwrZone, number>;

export type ClubSummary = {
  athleteCount: number;
  /** Mean of per-athlete avgLast30, weighted by arrow count for fairness. */
  avgClubScore: number | null;
  /** Mean of per-athlete stddev (only athletes that have one). */
  meanConsistency: number | null;
  totalArrowsLast30: number;
  totalSessionsLast30: number;
  zoneBreakdown: ZoneBreakdown;
  /** Highest avgLast30. `null` if no athlete has any data. */
  topPerformer: {
    id: string;
    name: string;
    avgLast30: number;
  } | null;
  /** Largest positive delta (avgLast30 - avgPrev30). Excludes nulls. */
  biggestImprover: {
    id: string;
    name: string;
    delta: number;
  } | null;
};

const EMPTY_ZONES: ZoneBreakdown = {
  inactive: 0,
  low: 0,
  optimal: 0,
  caution: 0,
  overload: 0
};

export function clubSummary(athletes: TeamAthleteSummary[]): ClubSummary {
  if (athletes.length === 0) {
    return {
      athleteCount: 0,
      avgClubScore: null,
      meanConsistency: null,
      totalArrowsLast30: 0,
      totalSessionsLast30: 0,
      zoneBreakdown: { ...EMPTY_ZONES },
      topPerformer: null,
      biggestImprover: null
    };
  }

  let totalArrows = 0;
  let totalSessions = 0;
  let weightedSum = 0; // sum(avg * arrows) → arrow-weighted club avg
  let weightedArrows = 0; // sum(arrows) for athletes with valid avg
  let stddevSum = 0;
  let stddevCount = 0;
  const zones: ZoneBreakdown = { ...EMPTY_ZONES };
  let top: ClubSummary['topPerformer'] = null;
  let improver: ClubSummary['biggestImprover'] = null;

  for (const a of athletes) {
    totalArrows += a.arrowsLast30;
    totalSessions += a.sessionsLast30;
    zones[a.acwrZone] = (zones[a.acwrZone] ?? 0) + 1;

    if (a.avgLast30 !== null) {
      weightedSum += a.avgLast30 * a.arrowsLast30;
      weightedArrows += a.arrowsLast30;
      if (top === null || a.avgLast30 > top.avgLast30) {
        top = {
          id: a.id,
          name: `${a.firstName} ${a.lastName}`,
          avgLast30: a.avgLast30
        };
      }
    }
    if (a.stddevLast30 !== null) {
      stddevSum += a.stddevLast30;
      stddevCount++;
    }
    if (a.avgLast30 !== null && a.avgPrev30 !== null) {
      const delta = a.avgLast30 - a.avgPrev30;
      if (improver === null || delta > improver.delta) {
        improver = {
          id: a.id,
          name: `${a.firstName} ${a.lastName}`,
          delta: Number(delta.toFixed(2))
        };
      }
    }
  }

  // Drop biggestImprover when it's actually a regression — sub-zero
  // deltas are not "improvements". UI should fall back to null.
  if (improver !== null && improver.delta <= 0) improver = null;

  const avgClubScore =
    weightedArrows > 0 ? Number((weightedSum / weightedArrows).toFixed(2)) : null;
  const meanConsistency =
    stddevCount > 0 ? Number((stddevSum / stddevCount).toFixed(2)) : null;

  return {
    athleteCount: athletes.length,
    avgClubScore,
    meanConsistency,
    totalArrowsLast30: totalArrows,
    totalSessionsLast30: totalSessions,
    zoneBreakdown: zones,
    topPerformer: top,
    biggestImprover: improver
  };
}

/**
 * One row per athlete-session: how many non-miss arrows were shot and
 * their score sum. The `sumScore / arrows` ratio gives the per-arrow
 * average for that session; weighting by `arrows` across all sessions
 * in a week gives the club's arrow-weighted weekly average.
 */
export type SessionPointForTrend = {
  date: Date;
  athleteId: string;
  arrows: number;
  sumScore: number;
};

export type WeeklyClubAgg = {
  /** Monday-00:00:00 UTC of that ISO week (same convention as training-load). */
  weekStart: Date;
  totalArrows: number;
  totalSessions: number;
  /** Arrow-weighted mean per-arrow score. null if the week had zero non-miss arrows. */
  avgClubScore: number | null;
  /** Distinct athletes with ≥1 session that week. */
  activeAthletes: number;
};

/**
 * Build a chronological weekly timeline of club activity ending at
 * `asOf`. Empty weeks are included with zeros so the chart shows gaps
 * (same approach as `weeklyAggregates` in training-load.ts).
 *
 * Pure. The caller is responsible for filtering sessions down to one
 * club; this function does not enforce that.
 */
export function clubWeeklyTrend(
  sessions: SessionPointForTrend[],
  weeks = 12,
  asOf: Date = new Date()
): WeeklyClubAgg[] {
  if (weeks < 1) return [];

  const lastWeekStart = startOfIsoWeekUTC(asOf);
  const firstWeekStart = addDaysUTC(lastWeekStart, -(weeks - 1) * 7);
  const exclusiveEnd = addDaysUTC(lastWeekStart, 7);
  const weekMs = 7 * 24 * 60 * 60 * 1000;

  type Bucket = {
    weekStart: Date;
    totalArrows: number;
    totalSessions: number;
    sumScore: number;
    athletes: Set<string>;
  };

  const buckets: Bucket[] = [];
  for (let i = 0; i < weeks; i++) {
    buckets.push({
      weekStart: addDaysUTC(firstWeekStart, i * 7),
      totalArrows: 0,
      totalSessions: 0,
      sumScore: 0,
      athletes: new Set()
    });
  }

  for (const s of sessions) {
    if (s.date < firstWeekStart) continue;
    if (s.date >= exclusiveEnd) continue;
    const wkStart = startOfIsoWeekUTC(s.date);
    const offset = Math.round(
      (wkStart.getTime() - firstWeekStart.getTime()) / weekMs
    );
    if (offset < 0 || offset >= weeks) continue;
    const b = buckets[offset];
    b.totalArrows += s.arrows;
    b.totalSessions += 1;
    b.sumScore += s.sumScore;
    b.athletes.add(s.athleteId);
  }

  return buckets.map((b) => ({
    weekStart: b.weekStart,
    totalArrows: b.totalArrows,
    totalSessions: b.totalSessions,
    avgClubScore:
      b.totalArrows > 0 ? Number((b.sumScore / b.totalArrows).toFixed(2)) : null,
    activeAthletes: b.athletes.size
  }));
}
