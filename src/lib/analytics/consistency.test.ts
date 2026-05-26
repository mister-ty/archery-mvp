import { describe, it, expect } from 'vitest';
import {
  mean,
  stddev,
  coefficientOfVariation,
  endBreakdown,
  sessionConsistency,
  stddevDelta,
  type ArrowSample
} from './consistency';

const arrow = (
  endNumber: number,
  arrowNumber: number,
  score: number,
  isMiss = false
): ArrowSample => ({ endNumber, arrowNumber, score, isMiss });

describe('mean', () => {
  it('returns null for empty arrays', () => {
    expect(mean([])).toBeNull();
  });
  it('computes the arithmetic mean', () => {
    expect(mean([10, 9, 8])).toBe(9);
    expect(mean([5, 5, 5, 5])).toBe(5);
  });
});

describe('stddev', () => {
  it('returns null for fewer than 2 values', () => {
    expect(stddev([])).toBeNull();
    expect(stddev([7])).toBeNull();
  });
  it('returns 0 for identical values', () => {
    expect(stddev([8, 8, 8, 8])).toBe(0);
  });
  it('uses Bessel (n-1) sample stddev', () => {
    // values: 10, 8, 9 → mean 9, deviations 1, -1, 0 → sumSq 2, /2 = 1, sqrt = 1
    expect(stddev([10, 8, 9])).toBeCloseTo(1, 5);
    // values: 6, 8, 10 → mean 8, devs -2,0,2 → sumSq 8, /2 = 4, sqrt 2
    expect(stddev([6, 8, 10])).toBeCloseTo(2, 5);
  });
});

describe('coefficientOfVariation', () => {
  it('returns null when mean is 0 (all zeros)', () => {
    expect(coefficientOfVariation([0, 0, 0])).toBeNull();
  });
  it('returns null when stddev is undefined (<2 values)', () => {
    expect(coefficientOfVariation([9])).toBeNull();
  });
  it('expresses stddev as percent of mean', () => {
    // stddev = 1, mean = 9 → CV ≈ 11.111%
    expect(coefficientOfVariation([10, 8, 9])).toBeCloseTo(11.111, 2);
  });
});

describe('endBreakdown', () => {
  it('groups arrows by end and computes per-end stats', () => {
    const arrows: ArrowSample[] = [
      arrow(1, 1, 10),
      arrow(1, 2, 9),
      arrow(1, 3, 9),
      arrow(2, 1, 8),
      arrow(2, 2, 7),
      arrow(2, 3, 8)
    ];
    const ends = endBreakdown(arrows);
    expect(ends).toHaveLength(2);

    expect(ends[0].endNumber).toBe(1);
    expect(ends[0].count).toBe(3);
    expect(ends[0].mean).toBeCloseTo(9.333, 2);
    expect(ends[0].rangeSpread).toBe(1);
    expect(ends[0].stddev).toBeCloseTo(0.577, 2);

    expect(ends[1].endNumber).toBe(2);
    expect(ends[1].count).toBe(3);
    expect(ends[1].mean).toBeCloseTo(7.667, 2);
  });

  it('excludes misses from numeric stats but counts them', () => {
    const arrows: ArrowSample[] = [
      arrow(1, 1, 10),
      arrow(1, 2, 0, true), // miss
      arrow(1, 3, 9)
    ];
    const [end] = endBreakdown(arrows);
    expect(end.count).toBe(2);
    expect(end.missCount).toBe(1);
    expect(end.mean).toBe(9.5);
    expect(end.stddev).toBeCloseTo(0.707, 2);
  });

  it('sorts numerically even when input is shuffled', () => {
    const arrows: ArrowSample[] = [
      arrow(3, 1, 8),
      arrow(1, 1, 10),
      arrow(2, 1, 9)
    ];
    const ends = endBreakdown(arrows);
    expect(ends.map((e) => e.endNumber)).toEqual([1, 2, 3]);
  });
});

describe('sessionConsistency', () => {
  it('returns nulls for an empty arrow set', () => {
    const s = sessionConsistency([]);
    expect(s.count).toBe(0);
    expect(s.mean).toBeNull();
    expect(s.stddev).toBeNull();
    expect(s.cv).toBeNull();
    expect(s.endVariability).toBeNull();
  });

  it('computes overall stats across all valid arrows', () => {
    const arrows: ArrowSample[] = [
      arrow(1, 1, 10),
      arrow(1, 2, 9),
      arrow(1, 3, 9),
      arrow(2, 1, 8),
      arrow(2, 2, 7),
      arrow(2, 3, 8)
    ];
    const s = sessionConsistency(arrows);
    expect(s.count).toBe(6);
    expect(s.mean).toBeCloseTo(8.5, 3);
    expect(s.stddev).toBeCloseTo(1.049, 2);
    expect(s.cv).toBeCloseTo(12.336, 2);
  });

  it('endVariability captures rhythm — high when ends differ much', () => {
    const arrows: ArrowSample[] = [
      // End 1 averages ~9.67
      arrow(1, 1, 10),
      arrow(1, 2, 10),
      arrow(1, 3, 9),
      // End 2 averages ~5
      arrow(2, 1, 5),
      arrow(2, 2, 5),
      arrow(2, 3, 5)
    ];
    const s = sessionConsistency(arrows);
    // End means are ~9.67 and 5 → big difference → endVariability is large.
    expect(s.endVariability).toBeGreaterThan(2);
  });

  it('endVariability is 0 when all ends have identical means', () => {
    const arrows: ArrowSample[] = [
      arrow(1, 1, 8),
      arrow(1, 2, 8),
      arrow(2, 1, 8),
      arrow(2, 2, 8)
    ];
    const s = sessionConsistency(arrows);
    expect(s.endVariability).toBe(0);
  });

  it('endVariability is null when only one end has data', () => {
    const arrows: ArrowSample[] = [
      arrow(1, 1, 9),
      arrow(1, 2, 9),
      arrow(1, 3, 9)
    ];
    expect(sessionConsistency(arrows).endVariability).toBeNull();
  });
});

describe('stddevDelta', () => {
  it('returns difference (current - previous)', () => {
    expect(stddevDelta(0.8, 1.2)).toBeCloseTo(-0.4, 5);
    expect(stddevDelta(1.5, 1.0)).toBeCloseTo(0.5, 5);
  });
  it('returns null when either side is unknown', () => {
    expect(stddevDelta(null, 1)).toBeNull();
    expect(stddevDelta(1, null)).toBeNull();
    expect(stddevDelta(null, null)).toBeNull();
  });
});
