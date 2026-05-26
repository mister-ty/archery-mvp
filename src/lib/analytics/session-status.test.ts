import { describe, it, expect } from 'vitest';
import {
  computeSessionCaptureStatus,
  formatRelativeDate
} from './session-status';

describe('computeSessionCaptureStatus', () => {
  it('returns pending when nothing captured', () => {
    expect(computeSessionCaptureStatus(36, 0)).toBe('pending');
  });

  it('returns partial when some arrows are in', () => {
    expect(computeSessionCaptureStatus(36, 1)).toBe('partial');
    expect(computeSessionCaptureStatus(36, 35)).toBe('partial');
  });

  it('returns complete on exact match', () => {
    expect(computeSessionCaptureStatus(36, 36)).toBe('complete');
  });

  it('returns complete defensively when over-captured', () => {
    expect(computeSessionCaptureStatus(36, 40)).toBe('complete');
  });

  it('treats negative captured as pending', () => {
    expect(computeSessionCaptureStatus(36, -1)).toBe('pending');
  });
});

describe('formatRelativeDate', () => {
  // Anchor "now" mid-morning so day-bucketing is unambiguous.
  const now = new Date(2026, 4, 24, 10, 0, 0); // 24 May 2026, local

  it('labels today, yesterday, tomorrow', () => {
    const today = new Date(2026, 4, 24, 18, 0, 0);
    const yesterday = new Date(2026, 4, 23, 8, 0, 0);
    const tomorrow = new Date(2026, 4, 25, 6, 0, 0);
    expect(formatRelativeDate(today, now)).toBe('Hoy');
    expect(formatRelativeDate(yesterday, now)).toBe('Ayer');
    expect(formatRelativeDate(tomorrow, now)).toBe('Mañana');
  });

  it('labels anteayer and pasado mañana', () => {
    const anteayer = new Date(2026, 4, 22, 12, 0, 0);
    const pasado = new Date(2026, 4, 26, 12, 0, 0);
    expect(formatRelativeDate(anteayer, now)).toBe('Anteayer');
    expect(formatRelativeDate(pasado, now)).toBe('Pasado mañana');
  });

  it('returns null outside the ±2-day window', () => {
    const old = new Date(2026, 4, 1, 12, 0, 0);
    const future = new Date(2026, 5, 10, 12, 0, 0);
    expect(formatRelativeDate(old, now)).toBeNull();
    expect(formatRelativeDate(future, now)).toBeNull();
  });

  it('handles dates at the very start/end of the day correctly', () => {
    const todayMidnight = new Date(2026, 4, 24, 0, 0, 0);
    const tomorrowEarly = new Date(2026, 4, 25, 0, 1, 0);
    expect(formatRelativeDate(todayMidnight, now)).toBe('Hoy');
    expect(formatRelativeDate(tomorrowEarly, now)).toBe('Mañana');
  });
});
