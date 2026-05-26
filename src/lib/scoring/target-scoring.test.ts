import { describe, it, expect } from 'vitest';
import {
  distanceFromCentre,
  projectTap,
  scoreFromTap,
  TARGET_RADIUS,
  X_RING_RADIUS
} from './target-scoring';

describe('scoreFromTap', () => {
  it('returns X for the dead centre', () => {
    expect(scoreFromTap({ x: 0, y: 0 })).toBe('X');
  });

  it('returns X anywhere inside the X-ring', () => {
    expect(scoreFromTap({ x: 3, y: 3 })).toBe('X'); // d ≈ 4.24
    expect(scoreFromTap({ x: X_RING_RADIUS, y: 0 })).toBe('X'); // d = 5 exactly
  });

  it('returns 10 just outside the X-ring', () => {
    expect(scoreFromTap({ x: 6, y: 0 })).toBe(10);
    expect(scoreFromTap({ x: 10, y: 0 })).toBe(10);
  });

  it('walks every scoring ring 9..1', () => {
    // Pick midpoints inside each ring so we don't sit on a boundary.
    expect(scoreFromTap({ x: 15, y: 0 })).toBe(9);
    expect(scoreFromTap({ x: 25, y: 0 })).toBe(8);
    expect(scoreFromTap({ x: 35, y: 0 })).toBe(7);
    expect(scoreFromTap({ x: 45, y: 0 })).toBe(6);
    expect(scoreFromTap({ x: 55, y: 0 })).toBe(5);
    expect(scoreFromTap({ x: 65, y: 0 })).toBe(4);
    expect(scoreFromTap({ x: 75, y: 0 })).toBe(3);
    expect(scoreFromTap({ x: 85, y: 0 })).toBe(2);
    expect(scoreFromTap({ x: 95, y: 0 })).toBe(1);
  });

  it('returns M past the outer ring', () => {
    expect(scoreFromTap({ x: TARGET_RADIUS + 0.01, y: 0 })).toBe('M');
    expect(scoreFromTap({ x: 200, y: 200 })).toBe('M');
  });

  it('respects the diagonal distance (sqrt symmetry)', () => {
    // 30, 40 → distance 50 → ring 5 → score 6
    expect(scoreFromTap({ x: 30, y: 40 })).toBe(6);
    // 60, 80 → distance 100 → ring 10 → score 1
    expect(scoreFromTap({ x: 60, y: 80 })).toBe(1);
  });
});

describe('distanceFromCentre', () => {
  it('matches the Pythagorean identity', () => {
    expect(distanceFromCentre({ x: 3, y: 4 })).toBeCloseTo(5);
    expect(distanceFromCentre({ x: 0, y: 0 })).toBe(0);
  });
});

describe('projectTap', () => {
  it('projects an event at the rect centre to (0, 0)', () => {
    const p = projectTap(150, 150, { width: 300, height: 300 });
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('projects the top-left corner to (-110, -110)', () => {
    const p = projectTap(0, 0, { width: 300, height: 300 });
    expect(p.x).toBeCloseTo(-110);
    expect(p.y).toBeCloseTo(-110);
  });

  it('projects the bottom-right corner to (110, 110)', () => {
    const p = projectTap(300, 300, { width: 300, height: 300 });
    expect(p.x).toBeCloseTo(110);
    expect(p.y).toBeCloseTo(110);
  });
});
