import { describe, it, expect } from 'vitest';
import {
  startOfIsoWeekUTC,
  weeklyAggregates,
  acwr,
  daysSinceLastSession,
  type SessionPoint
} from './training-load';

const utc = (s: string) => new Date(s);

describe('startOfIsoWeekUTC', () => {
  it('returns the Monday of the same week (UTC)', () => {
    // 2026-05-20 is a Wednesday → Monday is 2026-05-18.
    expect(startOfIsoWeekUTC(utc('2026-05-20T15:00:00Z')).toISOString()).toBe(
      '2026-05-18T00:00:00.000Z'
    );
  });

  it('treats Sunday as the LAST day of the previous week', () => {
    // 2026-05-24 is Sunday → Monday is 2026-05-18.
    expect(startOfIsoWeekUTC(utc('2026-05-24T23:59:59Z')).toISOString()).toBe(
      '2026-05-18T00:00:00.000Z'
    );
  });

  it('returns itself for a Monday', () => {
    // 2026-05-18 is a Monday.
    expect(startOfIsoWeekUTC(utc('2026-05-18T12:34:56Z')).toISOString()).toBe(
      '2026-05-18T00:00:00.000Z'
    );
  });
});

describe('weeklyAggregates', () => {
  const asOf = utc('2026-05-24T12:00:00Z'); // a Sunday → current week starts Mon 5-18

  it('returns `weeks` buckets ordered chronologically', () => {
    const w = weeklyAggregates([], 4, asOf);
    expect(w).toHaveLength(4);
    expect(w[0].weekStart.toISOString()).toBe('2026-04-27T00:00:00.000Z');
    expect(w[3].weekStart.toISOString()).toBe('2026-05-18T00:00:00.000Z');
    expect(w.every((b) => b.arrows === 0 && b.sessions === 0)).toBe(true);
  });

  it('counts arrows and sessions into the correct week bucket', () => {
    const sessions: SessionPoint[] = [
      { date: utc('2026-05-19T10:00:00Z'), arrowsCount: 36 }, // last week
      { date: utc('2026-05-20T10:00:00Z'), arrowsCount: 36 }, // last week
      { date: utc('2026-05-11T10:00:00Z'), arrowsCount: 30 } // 2 weeks ago
    ];
    const w = weeklyAggregates(sessions, 4, asOf);
    expect(w[2].arrows).toBe(30); // week of 5-11
    expect(w[2].sessions).toBe(1);
    expect(w[3].arrows).toBe(72); // week of 5-18
    expect(w[3].sessions).toBe(2);
    expect(w[0].arrows).toBe(0);
    expect(w[1].arrows).toBe(0);
  });

  it('drops sessions outside the window', () => {
    const sessions: SessionPoint[] = [
      { date: utc('2025-12-01T10:00:00Z'), arrowsCount: 100 } // way back
    ];
    const w = weeklyAggregates(sessions, 4, asOf);
    expect(w.every((b) => b.arrows === 0)).toBe(true);
  });

  it('handles weeks = 1 edge case', () => {
    const sessions: SessionPoint[] = [
      { date: utc('2026-05-20T10:00:00Z'), arrowsCount: 36 }
    ];
    const w = weeklyAggregates(sessions, 1, asOf);
    expect(w).toHaveLength(1);
    expect(w[0].arrows).toBe(36);
  });
});

describe('acwr', () => {
  const asOf = utc('2026-05-24T12:00:00Z');

  it('classifies "inactive" when there are no sessions', () => {
    const r = acwr([], asOf);
    expect(r.acuteArrows).toBe(0);
    expect(r.chronicArrowsPerWeek).toBeNull();
    expect(r.ratio).toBeNull();
    expect(r.zone).toBe('inactive');
  });

  it('computes the ratio as acute / weekly-chronic', () => {
    const sessions: SessionPoint[] = [];
    // Build 28 days of 30 arrows/day → chronic_total = 30*28 = 840,
    // chronic_per_week = 210. acute (last 7 days) = 30*7 = 210.
    // ratio = 1.0 → optimal.
    for (let i = 0; i < 28; i++) {
      sessions.push({
        date: new Date(asOf.getTime() - i * 86_400_000),
        arrowsCount: 30
      });
    }
    const r = acwr(sessions, asOf);
    expect(r.acuteArrows).toBe(210);
    expect(r.chronicArrowsPerWeek).toBe(210);
    expect(r.ratio).toBe(1);
    expect(r.zone).toBe('optimal');
  });

  it('classifies "low" when chronic > 0 but ratio < 0.8', () => {
    const sessions: SessionPoint[] = [];
    // Heavy training 14–28 days ago, almost none in the last 7.
    for (let i = 14; i < 28; i++) {
      sessions.push({
        date: new Date(asOf.getTime() - i * 86_400_000),
        arrowsCount: 50
      });
    }
    sessions.push({
      date: new Date(asOf.getTime() - 3 * 86_400_000),
      arrowsCount: 30
    });
    const r = acwr(sessions, asOf);
    expect(r.ratio).not.toBeNull();
    expect(r.ratio!).toBeLessThan(0.8);
    expect(r.zone).toBe('low');
  });

  it('classifies "overload" when ratio > 1.5', () => {
    const sessions: SessionPoint[] = [
      // Low chronic baseline (~3 weeks ago, one session)
      { date: new Date(asOf.getTime() - 21 * 86_400_000), arrowsCount: 60 },
      // Big acute spike in last 7 days
      { date: new Date(asOf.getTime() - 2 * 86_400_000), arrowsCount: 120 },
      { date: new Date(asOf.getTime() - 5 * 86_400_000), arrowsCount: 120 }
    ];
    const r = acwr(sessions, asOf);
    expect(r.ratio).not.toBeNull();
    expect(r.ratio!).toBeGreaterThan(1.5);
    expect(r.zone).toBe('overload');
  });

  it('classifies "caution" in the 1.3–1.5 band', () => {
    // chronic_total = 100 → chronic_per_week = 25; acute = 35; ratio = 1.4
    const sessions: SessionPoint[] = [
      { date: new Date(asOf.getTime() - 20 * 86_400_000), arrowsCount: 25 },
      { date: new Date(asOf.getTime() - 14 * 86_400_000), arrowsCount: 25 },
      { date: new Date(asOf.getTime() - 10 * 86_400_000), arrowsCount: 15 },
      { date: new Date(asOf.getTime() - 5 * 86_400_000), arrowsCount: 35 }
    ];
    const r = acwr(sessions, asOf);
    expect(r.ratio).not.toBeNull();
    expect(r.ratio!).toBeGreaterThan(1.3);
    expect(r.ratio!).toBeLessThanOrEqual(1.5);
    expect(r.zone).toBe('caution');
  });

  it('returns "low" when chronic = 0 but acute > 0 (just restarted)', () => {
    const sessions: SessionPoint[] = [
      { date: new Date(asOf.getTime() - 2 * 86_400_000), arrowsCount: 30 }
    ];
    const r = acwr(sessions, asOf);
    expect(r.chronicArrowsPerWeek).toBe(7.5); // 30 / 4
    expect(r.zone).toBe('overload'); // 30 / 7.5 = 4 → > 1.5
  });

  it('ignores future-dated sessions', () => {
    const sessions: SessionPoint[] = [
      { date: new Date(asOf.getTime() + 5 * 86_400_000), arrowsCount: 999 }
    ];
    const r = acwr(sessions, asOf);
    expect(r.acuteArrows).toBe(0);
    expect(r.zone).toBe('inactive');
  });
});

describe('daysSinceLastSession', () => {
  const asOf = utc('2026-05-24T12:00:00Z');

  it('returns null for an empty list', () => {
    expect(daysSinceLastSession([], asOf)).toBeNull();
  });

  it('returns 0 when latest session is today', () => {
    const s: SessionPoint[] = [
      { date: utc('2026-05-24T08:00:00Z'), arrowsCount: 36 }
    ];
    expect(daysSinceLastSession(s, asOf)).toBe(0);
  });

  it('floors to whole calendar days', () => {
    const s: SessionPoint[] = [
      { date: utc('2026-05-20T10:00:00Z'), arrowsCount: 36 }
    ];
    expect(daysSinceLastSession(s, asOf)).toBe(4);
  });

  it('uses the most recent session even when input is unsorted', () => {
    const s: SessionPoint[] = [
      { date: utc('2026-04-01T10:00:00Z'), arrowsCount: 36 },
      { date: utc('2026-05-22T10:00:00Z'), arrowsCount: 30 },
      { date: utc('2026-03-15T10:00:00Z'), arrowsCount: 24 }
    ];
    expect(daysSinceLastSession(s, asOf)).toBe(2);
  });

  it('clamps negative deltas to 0 (future-dated session)', () => {
    const s: SessionPoint[] = [
      { date: utc('2026-06-01T10:00:00Z'), arrowsCount: 30 }
    ];
    expect(daysSinceLastSession(s, asOf)).toBe(0);
  });
});
