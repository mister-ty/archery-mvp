import { describe, it, expect } from 'vitest';
import {
  competitionCreateSchema,
  competitionUpdateSchema
} from './competition';

const VALID_CUID = 'ckxxxxxxxxxxxxxxxxxxxxxx';

const base = {
  athleteId: VALID_CUID,
  name: 'Departamental Antioquia 2026',
  date: new Date('2026-04-15'),
  type: 'OUTDOOR_70M' as const,
  totalScore: 645
};

describe('competitionCreateSchema', () => {
  it('accepts a minimal valid entry', () => {
    expect(competitionCreateSchema.safeParse(base).success).toBe(true);
  });

  it('accepts ISO string dates via coerce', () => {
    const r = competitionCreateSchema.safeParse({
      ...base,
      date: '2026-04-15T00:00:00Z'
    });
    expect(r.success).toBe(true);
  });

  it('rejects future-dated entries (beyond a day of tolerance)', () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const r = competitionCreateSchema.safeParse({ ...base, date: future });
    expect(r.success).toBe(false);
  });

  it('rejects empty name after trim', () => {
    const r = competitionCreateSchema.safeParse({ ...base, name: '   ' });
    expect(r.success).toBe(false);
  });

  it('rejects invalid type', () => {
    const r = competitionCreateSchema.safeParse({
      ...base,
      type: 'NOT_A_REAL_TYPE'
    });
    expect(r.success).toBe(false);
  });

  it('rejects negative totalScore', () => {
    const r = competitionCreateSchema.safeParse({ ...base, totalScore: -1 });
    expect(r.success).toBe(false);
  });

  it('rejects totalScore that overflows realistic upper bound', () => {
    const r = competitionCreateSchema.safeParse({ ...base, totalScore: 5000 });
    expect(r.success).toBe(false);
  });

  it('rejects rank < 1', () => {
    const r = competitionCreateSchema.safeParse({ ...base, rank: 0 });
    expect(r.success).toBe(false);
  });

  it('accepts optional null fields', () => {
    const r = competitionCreateSchema.safeParse({
      ...base,
      location: null,
      rank: null,
      xCount: null,
      notes: null
    });
    expect(r.success).toBe(true);
  });

  it('rejects pre-1990 dates as out-of-range', () => {
    const r = competitionCreateSchema.safeParse({
      ...base,
      date: new Date('1980-01-01')
    });
    expect(r.success).toBe(false);
  });
});

describe('competitionUpdateSchema', () => {
  it('requires an id', () => {
    const r = competitionUpdateSchema.safeParse({ totalScore: 600 });
    expect(r.success).toBe(false);
  });

  it('allows partial updates with just an id and one field', () => {
    const r = competitionUpdateSchema.safeParse({
      id: VALID_CUID,
      totalScore: 700
    });
    expect(r.success).toBe(true);
  });
});
