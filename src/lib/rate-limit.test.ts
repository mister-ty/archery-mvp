import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  checkRateLimit,
  resetRateLimit,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS
} from './rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    resetRateLimit();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows the first request and reports remaining = MAX - 1', () => {
    const r = checkRateLimit('user:1');
    expect(r.success).toBe(true);
    expect(r.remaining).toBe(RATE_LIMIT_MAX - 1);
    expect(r.retryAfterMs).toBe(0);
  });

  it('allows exactly RATE_LIMIT_MAX requests before blocking', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      const r = checkRateLimit('user:burst');
      expect(r.success).toBe(true);
    }
    const blocked = checkRateLimit('user:burst');
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('keeps counters isolated by key', () => {
    for (let i = 0; i < RATE_LIMIT_MAX; i++) checkRateLimit('user:A');
    const blockedA = checkRateLimit('user:A');
    const stillOkB = checkRateLimit('user:B');
    expect(blockedA.success).toBe(false);
    expect(stillOkB.success).toBe(true);
  });

  it('resets the bucket after the window elapses', () => {
    vi.useFakeTimers();
    const t0 = new Date('2026-01-01T00:00:00Z').getTime();
    vi.setSystemTime(t0);

    for (let i = 0; i < RATE_LIMIT_MAX; i++) checkRateLimit('user:expire');
    expect(checkRateLimit('user:expire').success).toBe(false);

    // Advance past the window.
    vi.setSystemTime(t0 + RATE_LIMIT_WINDOW_MS + 1);
    const r = checkRateLimit('user:expire');
    expect(r.success).toBe(true);
    expect(r.remaining).toBe(RATE_LIMIT_MAX - 1);
  });

  it('reports the same resetAt across attempts within a window', () => {
    const a = checkRateLimit('user:steady');
    const b = checkRateLimit('user:steady');
    expect(a.resetAt).toBe(b.resetAt);
  });
});
