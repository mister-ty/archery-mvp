import { describe, it, expect } from 'vitest';
import {
  EDIT_WINDOW_MS,
  isSessionComplete,
  isWithinEditWindow,
  canStaffEditPostCompletion,
  canAthleteEdit,
  editableUntil,
} from './session-completion';

describe('isSessionComplete', () => {
  it('returns false for an empty set list', () => {
    expect(isSessionComplete([])).toBe(false);
  });

  it('returns false when any score set is partial', () => {
    expect(
      isSessionComplete([
        { endsCount: 6, arrowsPerEnd: 6, arrowCount: 36 },
        { endsCount: 6, arrowsPerEnd: 6, arrowCount: 30 },
      ])
    ).toBe(false);
  });

  it('returns true when all sets reach their expected count', () => {
    expect(
      isSessionComplete([
        { endsCount: 6, arrowsPerEnd: 6, arrowCount: 36 },
        { endsCount: 6, arrowsPerEnd: 6, arrowCount: 36 },
      ])
    ).toBe(true);
  });

  it('returns true when arrows exceed expected (over-capture safety)', () => {
    expect(
      isSessionComplete([{ endsCount: 6, arrowsPerEnd: 6, arrowCount: 40 }])
    ).toBe(true);
  });

  it('returns false when a single set is empty', () => {
    expect(
      isSessionComplete([{ endsCount: 6, arrowsPerEnd: 6, arrowCount: 0 }])
    ).toBe(false);
  });
});

describe('isWithinEditWindow', () => {
  it('returns false when completedAt is null', () => {
    expect(isWithinEditWindow(null)).toBe(false);
  });

  it('returns true exactly at the boundary (24h)', () => {
    const now = new Date('2026-01-02T00:00:00Z');
    const completed = new Date(now.getTime() - EDIT_WINDOW_MS);
    expect(isWithinEditWindow(completed, now)).toBe(true);
  });

  it('returns false just past 24h', () => {
    const now = new Date('2026-01-02T00:00:00Z');
    const completed = new Date(now.getTime() - EDIT_WINDOW_MS - 1);
    expect(isWithinEditWindow(completed, now)).toBe(false);
  });

  it('returns true for sessions that just completed', () => {
    const now = new Date('2026-01-02T00:00:00Z');
    const completed = new Date(now.getTime() - 60_000);
    expect(isWithinEditWindow(completed, now)).toBe(true);
  });
});

describe('canStaffEditPostCompletion', () => {
  const now = new Date('2026-01-02T12:00:00Z');

  it('rejects when session is active (completedAt null)', () => {
    expect(canStaffEditPostCompletion(null, now)).toBe(false);
  });

  it('accepts when session was just completed', () => {
    const completed = new Date(now.getTime() - 5 * 60 * 1000);
    expect(canStaffEditPostCompletion(completed, now)).toBe(true);
  });

  it('rejects when the 24h window has expired', () => {
    const completed = new Date(now.getTime() - EDIT_WINDOW_MS - 10_000);
    expect(canStaffEditPostCompletion(completed, now)).toBe(false);
  });
});

describe('canAthleteEdit', () => {
  const now = new Date('2026-01-02T12:00:00Z');

  it('accepts during active session', () => {
    expect(canAthleteEdit(null, now)).toBe(true);
  });

  it('accepts within edit window', () => {
    const completed = new Date(now.getTime() - 60 * 60 * 1000);
    expect(canAthleteEdit(completed, now)).toBe(true);
  });

  it('rejects after edit window expired', () => {
    const completed = new Date(now.getTime() - EDIT_WINDOW_MS - 60_000);
    expect(canAthleteEdit(completed, now)).toBe(false);
  });
});

describe('editableUntil', () => {
  it('returns null for null completedAt', () => {
    expect(editableUntil(null)).toBeNull();
  });

  it('returns 24h after completion', () => {
    const completed = new Date('2026-01-02T10:00:00Z');
    const until = editableUntil(completed);
    expect(until?.toISOString()).toBe('2026-01-03T10:00:00.000Z');
  });
});
