import { describe, it, expect } from 'vitest';
import { attendanceUpdateSchema } from './attendance';

const VALID_CUID = 'ckxxxxxxxxxxxxxxxxxxxxxx';

describe('attendanceUpdateSchema', () => {
  it('accepts PRESENT without reason', () => {
    const parsed = attendanceUpdateSchema.safeParse({
      sessionId: VALID_CUID,
      status: 'PRESENT'
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts ABSENT with reason', () => {
    const parsed = attendanceUpdateSchema.safeParse({
      sessionId: VALID_CUID,
      status: 'ABSENT',
      reason: 'Enfermedad'
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts ABSENT without reason (reason is optional)', () => {
    const parsed = attendanceUpdateSchema.safeParse({
      sessionId: VALID_CUID,
      status: 'ABSENT'
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const parsed = attendanceUpdateSchema.safeParse({
      sessionId: VALID_CUID,
      status: 'MAYBE'
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid sessionId (not a cuid)', () => {
    const parsed = attendanceUpdateSchema.safeParse({
      sessionId: 'not-a-cuid',
      status: 'PRESENT'
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects reason longer than 500 chars', () => {
    const parsed = attendanceUpdateSchema.safeParse({
      sessionId: VALID_CUID,
      status: 'LATE',
      reason: 'x'.repeat(501)
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts JUSTIFIED with empty reason (treated as no reason)', () => {
    const parsed = attendanceUpdateSchema.safeParse({
      sessionId: VALID_CUID,
      status: 'JUSTIFIED',
      reason: ''
    });
    expect(parsed.success).toBe(true);
  });

  it('accepts null reason', () => {
    const parsed = attendanceUpdateSchema.safeParse({
      sessionId: VALID_CUID,
      status: 'PRESENT',
      reason: null
    });
    expect(parsed.success).toBe(true);
  });
});
