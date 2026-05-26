/**
 * Score derivation for the interactive WA target.
 *
 * The target is rendered in an SVG viewBox centred at (0, 0) with an
 * outer radius of 100 units. Each scoring ring is 10 units thick; the
 * inner-X marker sits inside the innermost 10 ring at a radius of 5.
 *
 * Mapping (distance d from centre → ArrowValue):
 *  - d ≤ 5     → 'X'  (inner-10)
 *  - d ≤ 10    →  10
 *  - d ≤ 20    →   9
 *  - d ≤ 30    →   8
 *  - d ≤ 40    →   7
 *  - d ≤ 50    →   6
 *  - d ≤ 60    →   5
 *  - d ≤ 70    →   4
 *  - d ≤ 80    →   3
 *  - d ≤ 90    →   2
 *  - d ≤ 100   →   1
 *  - d > 100   → 'M'  (miss)
 *
 * Pure: no DOM, no React. Tested in target-scoring.test.ts.
 */

import type { ArrowValue } from '@/lib/validation/score';

export const TARGET_RADIUS = 100;
export const X_RING_RADIUS = 5;

export type Point = { x: number; y: number };

/** Euclidean distance from the centre of the target. */
export function distanceFromCentre(p: Point): number {
  return Math.sqrt(p.x * p.x + p.y * p.y);
}

/**
 * Map a tap on the target (centred coordinates) to a WA-archery score.
 * Inputs outside the outer ring are treated as misses.
 */
export function scoreFromTap(p: Point): ArrowValue {
  const d = distanceFromCentre(p);
  if (d > TARGET_RADIUS) return 'M';
  if (d <= X_RING_RADIUS) return 'X';
  // Convert distance to ring index 1..10 (1 = bullseye 10, 10 = outermost).
  const ringFromCentre = Math.ceil(d / 10);
  const score = 11 - ringFromCentre;
  // ringFromCentre is in [1..10] by the bounds above, so score is in [1..10].
  return score as ArrowValue;
}

/**
 * Project a raw event position (e.g. `clientX/Y` minus the SVG's bounding
 * rect) into the target's internal coordinate space. The SVG should be
 * rendered with viewBox `-110 -110 220 220` for the math to line up.
 */
export function projectTap(
  eventX: number,
  eventY: number,
  rect: { width: number; height: number }
): Point {
  const halfW = rect.width / 2;
  const halfH = rect.height / 2;
  // viewBox spans 220 across — each pixel maps to (220 / rect.width) units.
  const unitsPerPxX = 220 / rect.width;
  const unitsPerPxY = 220 / rect.height;
  return {
    x: (eventX - halfW) * unitsPerPxX,
    y: (eventY - halfH) * unitsPerPxY
  };
}
