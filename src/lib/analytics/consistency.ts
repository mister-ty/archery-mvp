/**
 * Consistency analytics for archery scores.
 *
 * Vocabulary:
 *  - "stddev"  : sample standard deviation (Bessel's correction, n-1).
 *  - "cv"      : coefficient of variation = stddev / mean × 100, in %.
 *                Normalises spread so different distances/levels compare.
 *  - "endVariability" : stddev of the per-end averages within a session;
 *                tells how stable the archer was end-to-end (rhythm).
 *
 * Conventions:
 *  - Only non-miss arrows are counted toward stats. A miss ("M") is a
 *    qualitatively different outcome and would dominate the variance.
 *  - Empty inputs return `null` (no metric possible), never NaN.
 *  - All results are plain numbers, not formatted strings. Formatting
 *    (e.g. ".toFixed(2)") happens at the UI boundary.
 *
 * All functions are pure — no React, no I/O, no `Date.now()`. Easy to
 * unit-test under any environment.
 */

export type ArrowSample = {
  endNumber: number;
  arrowNumber: number;
  score: number;
  isMiss: boolean;
};

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/**
 * Sample standard deviation (n-1). Returns `null` for fewer than 2 values
 * (with a single point, variance is undefined). For exactly identical
 * values, returns 0.
 */
export function stddev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = mean(values)!;
  let sumSq = 0;
  for (const v of values) {
    const d = v - m;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / (values.length - 1));
}

export function coefficientOfVariation(values: number[]): number | null {
  const m = mean(values);
  const s = stddev(values);
  if (m === null || s === null || m === 0) return null;
  return (s / m) * 100;
}

export type EndStats = {
  endNumber: number;
  count: number; // non-miss arrows in the end
  missCount: number;
  mean: number | null;
  stddev: number | null;
  cv: number | null;
  rangeSpread: number | null; // max - min of non-miss scores
};

export function endBreakdown(arrows: ArrowSample[]): EndStats[] {
  // Group by endNumber preserving the natural order.
  const groups = new Map<number, ArrowSample[]>();
  for (const a of arrows) {
    const g = groups.get(a.endNumber);
    if (g) g.push(a);
    else groups.set(a.endNumber, [a]);
  }

  const result: EndStats[] = [];
  // Sort ends numerically; Map preserves insertion order but the caller
  // might pass arrows in any order.
  const sortedEnds = [...groups.keys()].sort((a, b) => a - b);
  for (const endNumber of sortedEnds) {
    const inEnd = groups.get(endNumber)!;
    const valid = inEnd.filter((a) => !a.isMiss).map((a) => a.score);
    const m = mean(valid);
    const s = stddev(valid);
    const cv = coefficientOfVariation(valid);
    const rangeSpread =
      valid.length > 0 ? Math.max(...valid) - Math.min(...valid) : null;
    result.push({
      endNumber,
      count: valid.length,
      missCount: inEnd.length - valid.length,
      mean: m,
      stddev: s,
      cv,
      rangeSpread
    });
  }
  return result;
}

export type SessionConsistency = {
  count: number; // non-miss arrows
  missCount: number;
  mean: number | null;
  stddev: number | null;
  cv: number | null;
  endVariability: number | null; // stddev of per-end means
};

export function sessionConsistency(arrows: ArrowSample[]): SessionConsistency {
  const valid = arrows.filter((a) => !a.isMiss).map((a) => a.score);
  const missCount = arrows.length - valid.length;
  const m = mean(valid);
  const s = stddev(valid);
  const cv = coefficientOfVariation(valid);

  const ends = endBreakdown(arrows);
  const endMeans = ends
    .map((e) => e.mean)
    .filter((x): x is number => x !== null);
  const endVariability = endMeans.length >= 2 ? stddev(endMeans) : null;

  return {
    count: valid.length,
    missCount,
    mean: m,
    stddev: s,
    cv,
    endVariability
  };
}

/**
 * Delta utility — positive `delta` means stddev INCREASED (worse).
 * Returns `null` when either side is unknown.
 */
export function stddevDelta(
  current: number | null,
  previous: number | null
): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}
