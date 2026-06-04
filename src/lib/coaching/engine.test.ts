import { describe, expect, it } from 'vitest';
import { runCoachingEngine } from './engine';
import type { AthleteCoachingContext } from './types';

/**
 * Reasonable defaults so each test only changes what it cares about.
 * "Active athlete, 60 arrows over 30d, in the optimal ACWR zone."
 */
function makeCtx(overrides: Partial<AthleteCoachingContext> = {}): AthleteCoachingContext {
  return {
    athleteId: 'a1',
    athleteName: 'Sofía Ramírez',
    arrowsLast30: 60,
    arrowsPrev30: 60,
    sessionsLast30: 6,
    daysSinceLastSession: 1,
    avgLast30: 8.0,
    avgPrev30: 8.0,
    bestRoundLast30: 280,
    stddevLast30: 1.5,
    stddevPrev30: 1.5,
    acwrZone: 'optimal',
    acwrRatio: 1.0,
    attendancePct: 90,
    lastObservationAt: new Date(),
    arrowsThisWeek: 30,
    arrowsPrevWeek: 30,
    ...overrides
  };
}

describe('coaching engine', () => {
  it('returns no tips for a fully healthy athlete', () => {
    const tips = runCoachingEngine(makeCtx(), { audience: 'athlete' });
    expect(tips).toEqual([]);
  });

  it('fires noData.cold (warn) when the athlete has zero arrows', () => {
    const tips = runCoachingEngine(makeCtx({ arrowsLast30: 0 }), {
      audience: 'athlete'
    });
    expect(tips.map((t) => t.key)).toContain('noData.cold');
    expect(tips[0].severity).toBe('warn');
  });

  it('prioritises warn over suggest over info', () => {
    const tips = runCoachingEngine(
      makeCtx({
        acwrZone: 'overload',
        acwrRatio: 1.7,
        stddevLast30: 1.0,
        stddevPrev30: 1.5,
        arrowsLast30: 60
      }),
      { audience: 'athlete' }
    );
    // overload is warn, consistency.improving is info → warn first.
    expect(tips[0].key).toBe('acwr.overload');
    expect(tips[0].severity).toBe('warn');
  });

  it('dedupes by family — only one acwr tip per call', () => {
    const tips = runCoachingEngine(
      makeCtx({
        acwrZone: 'overload',
        acwrRatio: 1.7,
        daysSinceLastSession: 20
      }),
      { audience: 'athlete' }
    );
    const acwrTips = tips.filter((t) => t.key.startsWith('acwr.'));
    expect(acwrTips).toHaveLength(1);
  });

  it('respects audience filter — attendance.low never reaches the athlete', () => {
    const ctx = makeCtx({ attendancePct: 40 });
    const athleteTips = runCoachingEngine(ctx, { audience: 'athlete' });
    const coachTips = runCoachingEngine(ctx, { audience: 'coach' });
    expect(athleteTips.map((t) => t.key)).not.toContain('attendance.low');
    expect(coachTips.map((t) => t.key)).toContain('attendance.low');
  });

  it('caps the result at topN (default 3) but unlimited when topN: null', () => {
    // Stack several rules so we generate >3 tips.
    const ctx = makeCtx({
      acwrZone: 'overload',
      acwrRatio: 1.7,
      avgLast30: 6.0,
      avgPrev30: 8.0,
      stddevLast30: 2.5,
      stddevPrev30: 1.5,
      attendancePct: 40,
      arrowsLast30: 60,
      arrowsThisWeek: 5,
      arrowsPrevWeek: 60
    });
    expect(runCoachingEngine(ctx, { audience: 'coach' })).toHaveLength(3);
    expect(
      runCoachingEngine(ctx, { audience: 'coach', topN: null }).length
    ).toBeGreaterThan(3);
  });

  it('ignores trend rules when sample is below 30 arrows', () => {
    const tips = runCoachingEngine(
      makeCtx({
        arrowsLast30: 12,
        avgLast30: 6.0,
        avgPrev30: 8.0
      }),
      { audience: 'athlete' }
    );
    expect(tips.map((t) => t.key)).not.toContain('evolution.dropVsPrev30');
  });

  it('hydrates the actual numbers into the detail string', () => {
    const tips = runCoachingEngine(
      makeCtx({ acwrZone: 'overload', acwrRatio: 1.73 }),
      { audience: 'coach' }
    );
    expect(tips[0].detail).toContain('1.73');
  });

  it('inactive athlete (>14 d) overrides ACWR caution by family dedup', () => {
    const tips = runCoachingEngine(
      makeCtx({
        daysSinceLastSession: 30,
        acwrZone: 'caution',
        acwrRatio: 1.4
      }),
      { audience: 'athlete' }
    );
    const acwr = tips.find((t) => t.key.startsWith('acwr.'));
    expect(acwr?.key).toBe('acwr.inactive');
  });

  it('onlyKeys restricts to a subset (used by session-close)', () => {
    const ctx = makeCtx({
      acwrZone: 'overload',
      acwrRatio: 1.7,
      lastSession: {
        sessionId: 's1',
        avgScore: 9.5,
        arrowsCount: 36,
        isNewBestRound: false
      }
    });
    const tips = runCoachingEngine(ctx, {
      audience: 'athlete',
      onlyKeys: ['session.aboveAvg', 'session.belowAvg', 'evolution.bestRound'],
      topN: null
    });
    expect(tips.every((t) => t.key.startsWith('session.') || t.key === 'evolution.bestRound')).toBe(
      true
    );
    expect(tips.map((t) => t.key)).toContain('session.aboveAvg');
  });
});

describe('individual rule behaviour', () => {
  it('consistency.improving needs ≥30 arrows and stddev drop ≥15%', () => {
    const fewArrows = runCoachingEngine(
      makeCtx({ arrowsLast30: 10, stddevLast30: 1.0, stddevPrev30: 1.5 }),
      { audience: 'athlete' }
    );
    expect(fewArrows.map((t) => t.key)).not.toContain('consistency.improving');

    const enoughArrows = runCoachingEngine(
      makeCtx({ arrowsLast30: 60, stddevLast30: 1.0, stddevPrev30: 1.5 }),
      { audience: 'athlete' }
    );
    expect(enoughArrows.map((t) => t.key)).toContain('consistency.improving');
  });

  it('coachObs.stale fires when lastObservationAt is null and athlete is active', () => {
    const coachTips = runCoachingEngine(
      makeCtx({ lastObservationAt: null, arrowsLast30: 60 }),
      { audience: 'coach' }
    );
    expect(coachTips.map((t) => t.key)).toContain('coachObs.stale');

    // But NOT when the athlete has no activity — noData.cold owns that case.
    const coldCoach = runCoachingEngine(
      makeCtx({ lastObservationAt: null, arrowsLast30: 0 }),
      { audience: 'coach' }
    );
    expect(coldCoach.map((t) => t.key)).not.toContain('coachObs.stale');
  });

  it('volume.dropoffWeek requires a non-trivial previous week', () => {
    const tinyPrev = runCoachingEngine(
      makeCtx({ arrowsThisWeek: 0, arrowsPrevWeek: 10 }),
      { audience: 'athlete' }
    );
    expect(tinyPrev.map((t) => t.key)).not.toContain('volume.dropoffWeek');

    const realDropoff = runCoachingEngine(
      makeCtx({ arrowsThisWeek: 5, arrowsPrevWeek: 60 }),
      { audience: 'athlete' }
    );
    expect(realDropoff.map((t) => t.key)).toContain('volume.dropoffWeek');
  });
});
