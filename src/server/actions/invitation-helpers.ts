import crypto from 'node:crypto';
import { Role } from '@prisma/client';

export const INVITE_TTL_DAYS = 7;
export const BCRYPT_ROUNDS = 12;

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function buildInvitationLink(token: string): string {
  const base =
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000';
  return `${base.replace(/\/$/, '')}/activar/${token}`;
}

/**
 * RBAC for who-can-invite-which-role:
 *  - SUPER_ADMIN: any role, any club
 *  - CLUB_ADMIN: COACH / ATHLETE for own club
 *  - COACH:      ATHLETE for own club
 *  - ATHLETE:    none
 */
export function canInvite(
  callerRole: Role,
  callerClubId: string | null,
  targetRole: 'ATHLETE' | 'COACH' | 'CLUB_ADMIN',
  targetClubId: string
): boolean {
  if (callerRole === Role.SUPER_ADMIN) return true;
  if (callerClubId !== targetClubId) return false;
  if (callerRole === Role.CLUB_ADMIN) {
    return targetRole === 'COACH' || targetRole === 'ATHLETE';
  }
  if (callerRole === Role.COACH) {
    return targetRole === 'ATHLETE';
  }
  return false;
}
