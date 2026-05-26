import { describe, it, expect } from 'vitest';
import {
  invitationCreateSchema,
  invitationAcceptSchema,
  coachOnboardingSchema
} from './invitation';

const VALID_CUID = 'ckxxxxxxxxxxxxxxxxxxxxxx';

describe('invitationCreateSchema', () => {
  it('accepts a valid invitation', () => {
    const parsed = invitationCreateSchema.safeParse({
      email: 'alice@example.com',
      role: 'COACH',
      clubId: VALID_CUID
    });
    expect(parsed.success).toBe(true);
  });

  it('lowercases and trims the email', () => {
    const parsed = invitationCreateSchema.safeParse({
      email: '  Alice@Example.COM  ',
      role: 'COACH',
      clubId: VALID_CUID
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe('alice@example.com');
  });

  it('rejects invalid email', () => {
    const parsed = invitationCreateSchema.safeParse({
      email: 'not-an-email',
      role: 'COACH',
      clubId: VALID_CUID
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects SUPER_ADMIN role (not invitable)', () => {
    const parsed = invitationCreateSchema.safeParse({
      email: 'alice@example.com',
      role: 'SUPER_ADMIN',
      clubId: VALID_CUID
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects malformed cuid', () => {
    const parsed = invitationCreateSchema.safeParse({
      email: 'alice@example.com',
      role: 'COACH',
      clubId: 'not-a-cuid'
    });
    expect(parsed.success).toBe(false);
  });
});

describe('invitationAcceptSchema', () => {
  const base = {
    token: 'a'.repeat(64),
    password: 'longenoughpw',
    passwordConfirm: 'longenoughpw'
  };

  it('accepts matching passwords ≥8 chars', () => {
    const parsed = invitationAcceptSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it('rejects password shorter than 8 chars', () => {
    const parsed = invitationAcceptSchema.safeParse({
      ...base,
      password: 'short',
      passwordConfirm: 'short'
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects when passwords do not match', () => {
    const parsed = invitationAcceptSchema.safeParse({
      ...base,
      passwordConfirm: 'differentpw1'
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.flatten().fieldErrors.passwordConfirm).toBeDefined();
    }
  });

  it('rejects token shorter than 16 chars', () => {
    const parsed = invitationAcceptSchema.safeParse({
      ...base,
      token: 'abc'
    });
    expect(parsed.success).toBe(false);
  });

  it('accepts optional firstName/lastName', () => {
    const parsed = invitationAcceptSchema.safeParse({
      ...base,
      firstName: 'Carlos',
      lastName: 'Mendoza'
    });
    expect(parsed.success).toBe(true);
  });
});

describe('coachOnboardingSchema', () => {
  it('accepts non-empty trimmed names', () => {
    const parsed = coachOnboardingSchema.safeParse({
      firstName: 'Carlos',
      lastName: 'Mendoza'
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects empty firstName after trimming', () => {
    const parsed = coachOnboardingSchema.safeParse({
      firstName: '   ',
      lastName: 'Mendoza'
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects names longer than 80 chars', () => {
    const parsed = coachOnboardingSchema.safeParse({
      firstName: 'x'.repeat(81),
      lastName: 'Mendoza'
    });
    expect(parsed.success).toBe(false);
  });
});
