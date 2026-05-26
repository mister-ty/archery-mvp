import { describe, it, expect } from 'vitest';
import {
  arrowAtProgress,
  linearAtProgress,
  BEZIER_P0,
  BULLSEYE,
  IMPACT_THRESHOLD
} from './arrow-trajectory';

describe('arrowAtProgress', () => {
  it('starts at P0 when t = 0', () => {
    const r = arrowAtProgress(0);
    expect(r.x).toBeCloseTo(BEZIER_P0.x, 5);
    expect(r.y).toBeCloseTo(BEZIER_P0.y, 5);
  });

  it('lands exactly on the bullseye at the impact threshold', () => {
    const r = arrowAtProgress(IMPACT_THRESHOLD);
    expect(r.x).toBeCloseTo(BULLSEYE.x, 5);
    expect(r.y).toBeCloseTo(BULLSEYE.y, 5);
  });

  it('stays on the bullseye for t past the impact threshold', () => {
    const r = arrowAtProgress(1.0);
    expect(r.x).toBeCloseTo(BULLSEYE.x, 5);
    expect(r.y).toBeCloseTo(BULLSEYE.y, 5);
  });

  it('clamps negative and over-1 inputs', () => {
    expect(arrowAtProgress(-0.5).y).toBeCloseTo(BEZIER_P0.y, 5);
    expect(arrowAtProgress(NaN).y).toBeCloseTo(BEZIER_P0.y, 5);
    expect(arrowAtProgress(2.0).x).toBeCloseTo(BULLSEYE.x, 5);
  });

  it('bows above the straight line midway through (curve really curves)', () => {
    // At t = IMPACT_THRESHOLD / 2 the curve must lie ABOVE the straight
    // line P0→P2 (smaller y in SVG = higher on screen). The control point
    // P1 sits well above the straight line, so this should hold.
    const midProgress = IMPACT_THRESHOLD / 2;
    const curve = arrowAtProgress(midProgress);
    const straight = linearAtProgress(midProgress);
    expect(curve.y).toBeLessThan(straight.y);
  });

  it('initial tangent points up-and-to-the-right', () => {
    // At t = 0 the tangent goes from P0 toward P1: dx > 0 (right),
    // dy < 0 (up in SVG-screen-space, since P1.y < P0.y).
    // angle = atan2(dy, dx) — with dx > 0 and dy < 0 the angle is
    // negative (between -90° and 0°).
    const { angle } = arrowAtProgress(0);
    expect(angle).toBeLessThan(0);
    expect(angle).toBeGreaterThan(-90);
  });
});
