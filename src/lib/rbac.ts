import { Role } from '@prisma/client';
import { auth } from './auth';

export class AuthorizationError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class AuthenticationError extends Error {
  constructor(message = 'Unauthenticated') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Require an authenticated session. Throws AuthenticationError otherwise.
 */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new AuthenticationError();
  return session;
}

/**
 * Require a session whose role is in the allowed set.
 */
export async function requireRole(allowed: Role[]) {
  const session = await requireSession();
  if (!allowed.includes(session.user.role)) throw new AuthorizationError();
  return session;
}

/**
 * Coaches and club admins can manage athletes within their own club only.
 * Super admins can manage any.
 */
export function canManageClub(
  userRole: Role,
  userClubId: string | null,
  targetClubId: string
): boolean {
  if (userRole === Role.SUPER_ADMIN) return true;
  if (userRole === Role.CLUB_ADMIN || userRole === Role.COACH) {
    return userClubId === targetClubId;
  }
  return false;
}
