/**
 * Arrow-to-bullseye trajectory for the scroll-driven background.
 * Pure: no DOM, no React. Tested in arrow-trajectory.test.ts.
 *
 * Coordinate space matches the SVG viewBox (0..100 in both axes).
 * Y grows downward (SVG convention), so the "up-right" tangent at the
 * start has a negative dy and a positive dx.
 */

export type Point = { x: number; y: number };

export const BEZIER_P0: Point = { x: -10, y: 95 }; // off-screen bottom-left
export const BEZIER_P1: Point = { x: 30, y: 40 }; // control — pulls trajectory up
export const BEZIER_P2: Point = { x: 82, y: 18 }; // bullseye on the target

export const BULLSEYE: Point = BEZIER_P2;

/** Fraction of scroll progress at which the arrow lands. */
export const IMPACT_THRESHOLD = 0.85;

function clamp01(t: number): number {
  if (Number.isNaN(t)) return 0;
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Position along a quadratic Bezier defined by P0, P1, P2 at parameter t'.
 * Standard formula: (1-t')²·P0 + 2(1-t')·t'·P1 + (t')²·P2.
 */
function bezierPoint(tPrime: number): Point {
  const oneMinus = 1 - tPrime;
  const a = oneMinus * oneMinus;
  const b = 2 * oneMinus * tPrime;
  const c = tPrime * tPrime;
  return {
    x: a * BEZIER_P0.x + b * BEZIER_P1.x + c * BEZIER_P2.x,
    y: a * BEZIER_P0.y + b * BEZIER_P1.y + c * BEZIER_P2.y
  };
}

/**
 * Tangent vector at parameter t' — derivative of the quadratic Bezier:
 *   B'(t) = 2(1-t')·(P1-P0) + 2t'·(P2-P1)
 */
function bezierTangent(tPrime: number): Point {
  const oneMinus = 1 - tPrime;
  return {
    x: 2 * oneMinus * (BEZIER_P1.x - BEZIER_P0.x) + 2 * tPrime * (BEZIER_P2.x - BEZIER_P1.x),
    y: 2 * oneMinus * (BEZIER_P1.y - BEZIER_P0.y) + 2 * tPrime * (BEZIER_P2.y - BEZIER_P1.y)
  };
}

/**
 * Compute the arrow's position and orientation given an unclamped scroll
 * progress in [0, 1]. The flight occupies the first IMPACT_THRESHOLD of
 * progress; afterwards the arrow stays embedded in the bullseye.
 *
 * `angle` is in degrees, suitable for CSS `rotate(...)` — 0° = pointing
 * right, 90° = pointing down (SVG screen-space convention).
 */
export function arrowAtProgress(t: number): { x: number; y: number; angle: number } {
  const clamped = clamp01(t);
  if (clamped >= IMPACT_THRESHOLD) {
    // Arrow has landed: stuck on the bullseye, oriented along the final
    // tangent so it visually "sticks out" naturally.
    const tangent = bezierTangent(1);
    return {
      x: BULLSEYE.x,
      y: BULLSEYE.y,
      angle: (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI
    };
  }
  const tPrime = clamped / IMPACT_THRESHOLD;
  const point = bezierPoint(tPrime);
  const tangent = bezierTangent(tPrime);
  return {
    x: point.x,
    y: point.y,
    angle: (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI
  };
}

/** Linear path point at progress — used only by the test to compare
 *  against the Bezier and confirm the curve actually bows. */
export function linearAtProgress(t: number): Point {
  const tPrime = clamp01(t) / IMPACT_THRESHOLD;
  return {
    x: lerp(BEZIER_P0.x, BEZIER_P2.x, tPrime),
    y: lerp(BEZIER_P0.y, BEZIER_P2.y, tPrime)
  };
}
