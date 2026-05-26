import { describe, it, expect } from 'vitest';
import {
  clubSummary,
  clubWeeklyTrend,
  type SessionPointForTrend,
  type TeamAthleteSummary
} from './team-aggregate';

const make = (
  id: string,
  overrides: Partial<TeamAthleteSummary> = {}
): TeamAthleteSummary => ({
  id,
  firstName: `First${id}`,
  lastName: `Last${id}`,
  avgLast30: null,
  avgPrev30: null,
  stddevLast30: null,
  arrowsLast30: 0,
  sessionsLast30: 0,
  acwrZone: 'inactive',
  ...overrides
});

describe('clubSummary', () => {
  it('returns the empty snapshot for no athletes', () => {
    const s = clubSummary([]);
    expect(s.athleteCount).toBe(0);
    expect(s.avgClubScore).toBeNull();
    expect(s.meanConsistency).toBeNull();
    expect(s.totalArrowsLast30).toBe(0);
    expect(s.totalSessionsLast30).toBe(0);
    expect(s.zoneBreakdown).toEqual({
      inactive: 0,
      low: 0,
      optimal: 0,
      caution: 0,
      overload: 0
    });
    expect(s.topPerformer).toBeNull();
    expect(s.biggestImprover).toBeNull();
  });

  it('counts athletes and groups by ACWR zone', () => {
    const s = clubSummary([
      make('1', { acwrZone: 'optimal' }),
      make('2', { acwrZone: 'optimal' }),
      make('3', { acwrZone: 'low' }),
      make('4', { acwrZone: 'overload' })
    ]);
    expect(s.athleteCount).toBe(4);
    expect(s.zoneBreakdown.optimal).toBe(2);
    expect(s.zoneBreakdown.low).toBe(1);
    expect(s.zoneBreakdown.overload).toBe(1);
    expect(s.zoneBreakdown.inactive).toBe(0);
  });

  it('totals arrows and sessions across athletes', () => {
    const s = clubSummary([
      make('1', { arrowsLast30: 120, sessionsLast30: 4 }),
      make('2', { arrowsLast30: 60, sessionsLast30: 2 }),
      make('3') // zeroes
    ]);
    expect(s.totalArrowsLast30).toBe(180);
    expect(s.totalSessionsLast30).toBe(6);
  });

  it('weights club avg by arrow count, not athlete count', () => {
    // Athlete A: 200 arrows at 9.0 → contributes 1800
    // Athlete B:  20 arrows at 5.0 → contributes  100
    // weighted = (1800 + 100) / 220 = 8.636...
    // Unweighted mean would be (9 + 5) / 2 = 7.0 — would mis-represent.
    const s = clubSummary([
      make('A', { avgLast30: 9.0, arrowsLast30: 200 }),
      make('B', { avgLast30: 5.0, arrowsLast30: 20 })
    ]);
    expect(s.avgClubScore).toBeCloseTo(8.64, 2);
  });

  it('skips athletes without avgLast30 from the club avg', () => {
    const s = clubSummary([
      make('A', { avgLast30: 8.0, arrowsLast30: 50 }),
      make('B') // no data
    ]);
    expect(s.avgClubScore).toBe(8);
  });

  it('returns null club avg when no athlete has any arrows', () => {
    const s = clubSummary([make('A'), make('B')]);
    expect(s.avgClubScore).toBeNull();
  });

  it('mean consistency averages defined stddev values', () => {
    const s = clubSummary([
      make('A', { stddevLast30: 1.0 }),
      make('B', { stddevLast30: 2.0 }),
      make('C') // null stddev, skipped
    ]);
    expect(s.meanConsistency).toBe(1.5);
  });

  it('picks the top performer by avgLast30', () => {
    const s = clubSummary([
      make('A', { avgLast30: 7.2, arrowsLast30: 30 }),
      make('B', { avgLast30: 8.4, arrowsLast30: 30 }),
      make('C', { avgLast30: 8.1, arrowsLast30: 30 })
    ]);
    expect(s.topPerformer).toEqual(
      expect.objectContaining({ id: 'B', avgLast30: 8.4 })
    );
  });

  it('topPerformer is null when no athlete has avgLast30', () => {
    expect(clubSummary([make('A'), make('B')]).topPerformer).toBeNull();
  });

  it('finds the biggest positive delta as biggestImprover', () => {
    const s = clubSummary([
      make('A', { avgLast30: 8.0, avgPrev30: 7.5, arrowsLast30: 30 }), // +0.5
      make('B', { avgLast30: 7.0, avgPrev30: 7.0, arrowsLast30: 30 }), // 0
      make('C', { avgLast30: 9.0, avgPrev30: 8.0, arrowsLast30: 30 })  // +1
    ]);
    expect(s.biggestImprover).toEqual(
      expect.objectContaining({ id: 'C', delta: 1 })
    );
  });

  it('biggestImprover is null when all deltas are non-positive', () => {
    const s = clubSummary([
      make('A', { avgLast30: 7.0, avgPrev30: 7.5, arrowsLast30: 30 }), // -0.5
      make('B', { avgLast30: 6.5, avgPrev30: 7.0, arrowsLast30: 30 })  // -0.5
    ]);
    expect(s.biggestImprover).toBeNull();
  });

  it('biggestImprover skips athletes missing either window', () => {
    const s = clubSummary([
      make('A', { avgLast30: 8.0, avgPrev30: null, arrowsLast30: 30 }),
      make('B', { avgLast30: 7.0, avgPrev30: 6.0, arrowsLast30: 30 }) // +1
    ]);
    expect(s.biggestImprover?.id).toBe('B');
  });
});

describe('clubWeeklyTrend', () => {
  // Anchor "now" at a fixed Wednesday so the most-recent week starts on
  // Monday 2026-05-18 UTC. Keeps the tests deterministic across runs.
  const asOf = new Date('2026-05-20T12:00:00.000Z'); // Wed
  const mondayOfThisWeek = new Date('2026-05-18T00:00:00.000Z');

  const mk = (
    daysBack: number,
    overrides: Partial<SessionPointForTrend> = {}
  ): SessionPointForTrend => ({
    date: new Date(asOf.getTime() - daysBack * 24 * 60 * 60 * 1000),
    athleteId: 'A',
    arrows: 30,
    sumScore: 240,
    ...overrides
  });

  it('returns `weeks` empty buckets when no sessions', () => {
    const t = clubWeeklyTrend([], 12, asOf);
    expect(t).toHaveLength(12);
    expect(t.every((w) => w.totalArrows === 0 && w.totalSessions === 0)).toBe(true);
    expect(t.every((w) => w.avgClubScore === null)).toBe(true);
    expect(t.every((w) => w.activeAthletes === 0)).toBe(true);
    expect(t[11].weekStart.getTime()).toBe(mondayOfThisWeek.getTime());
  });

  it('aggregates a single-athlete session into the right week', () => {
    const t = clubWeeklyTrend(
      [mk(2, { arrows: 36, sumScore: 9 * 36 })], // Monday, this week
      12,
      asOf
    );
    const last = t[11];
    expect(last.totalArrows).toBe(36);
    expect(last.totalSessions).toBe(1);
    expect(last.avgClubScore).toBe(9);
    expect(last.activeAthletes).toBe(1);
  });

  it('weights the weekly avg by arrow count when athletes differ in volume', () => {
    // Same week: A shoots 100 arrows at avg 9.0 (sumScore 900)
    //            B shoots  10 arrows at avg 5.0 (sumScore  50)
    // Weighted avg = 950 / 110 = 8.636...
    const t = clubWeeklyTrend(
      [
        mk(2, { athleteId: 'A', arrows: 100, sumScore: 900 }),
        mk(2, { athleteId: 'B', arrows: 10, sumScore: 50 })
      ],
      12,
      asOf
    );
    expect(t[11].avgClubScore).toBeCloseTo(8.64, 2);
    expect(t[11].activeAthletes).toBe(2);
  });

  it('counts distinct active athletes per week, not session rows', () => {
    // Same athlete shoots twice in the same week → activeAthletes = 1.
    const t = clubWeeklyTrend(
      [
        mk(2, { athleteId: 'A', arrows: 30, sumScore: 240 }),
        mk(1, { athleteId: 'A', arrows: 30, sumScore: 240 })
      ],
      12,
      asOf
    );
    expect(t[11].totalSessions).toBe(2);
    expect(t[11].activeAthletes).toBe(1);
  });

  it('places a session exactly on Monday 00:00 UTC inside that week', () => {
    const t = clubWeeklyTrend(
      [{ date: mondayOfThisWeek, athleteId: 'A', arrows: 10, sumScore: 80 }],
      12,
      asOf
    );
    expect(t[11].totalSessions).toBe(1);
    expect(t[10].totalSessions).toBe(0);
  });

  it('ignores sessions outside the [first-week, last-week] window', () => {
    const t = clubWeeklyTrend(
      [
        mk(200), // way before the 12-week window
        mk(2)    // inside the window
      ],
      12,
      asOf
    );
    expect(t.reduce((s, w) => s + w.totalSessions, 0)).toBe(1);
  });

  it('records sessions of all-miss arrows as activity but null avgClubScore', () => {
    // A session with arrows=0 and sumScore=0 still counts as a session,
    // but contributes nothing to arrows or weighted avg. The avg stays
    // null when the week has zero non-miss arrows.
    const t = clubWeeklyTrend(
      [mk(2, { arrows: 0, sumScore: 0 })],
      12,
      asOf
    );
    expect(t[11].totalSessions).toBe(1);
    expect(t[11].totalArrows).toBe(0);
    expect(t[11].avgClubScore).toBeNull();
  });

  it('honours custom weeks parameter', () => {
    expect(clubWeeklyTrend([], 1, asOf)).toHaveLength(1);
    expect(clubWeeklyTrend([], 4, asOf)).toHaveLength(4);
    expect(clubWeeklyTrend([], 0, asOf)).toHaveLength(0);
  });
});
