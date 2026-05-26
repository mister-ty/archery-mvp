'use server';

import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { db } from '@/lib/db';
import {
  athleteCreateSchema,
  athleteUpdateSchema,
  type AthleteCreateInput,
  type AthleteUpdateInput
} from '@/lib/validation/athlete';
import { canManageClub, requireRole } from '@/lib/rbac';
import {
  INVITE_TTL_DAYS,
  buildInvitationLink,
  generateInviteToken
} from './invitation-helpers';
import { sendEmail } from '@/lib/email/send';
import { invitationEmail } from '@/lib/email/templates';

export type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export async function listAthletes(filters?: {
  search?: string;
  bowModalityId?: string;
  activeOnly?: boolean;
}) {
  const session = await requireRole([
    Role.COACH,
    Role.CLUB_ADMIN,
    Role.SUPER_ADMIN
  ]);

  const where: Record<string, unknown> = {};
  if (session.user.role !== Role.SUPER_ADMIN) {
    where.clubId = session.user.clubId;
  }
  if (filters?.activeOnly !== false) where.active = true;
  if (filters?.bowModalityId) where.bowModalityId = filters.bowModalityId;
  if (filters?.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { documentId: { contains: filters.search, mode: 'insensitive' } }
    ];
  }

  return db.athlete.findMany({
    where,
    include: {
      bowModality: true,
      category: true,
      coach: { select: { firstName: true, lastName: true } }
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
  });
}

export async function createAthlete(
  input: AthleteCreateInput
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole([
    Role.COACH,
    Role.CLUB_ADMIN,
    Role.SUPER_ADMIN
  ]);

  const parsed = athleteCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }

  const data = parsed.data;

  if (
    !canManageClub(session.user.role, session.user.clubId, data.clubId)
  ) {
    return { ok: false, error: 'No tienes permiso sobre este club' };
  }

  try {
    const created = await db.athlete.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        documentId: data.documentId,
        birthDate: data.birthDate,
        dominantHand: data.dominantHand,
        bowModalityId: data.bowModalityId,
        categoryId: data.categoryId,
        clubId: data.clubId,
        coachId: data.coachId ?? null
      },
      select: { id: true }
    });

    revalidatePath('/deportistas');
    return { ok: true, data: created };
  } catch (e: unknown) {
    if (
      typeof e === 'object' &&
      e !== null &&
      'code' in e &&
      (e as { code: string }).code === 'P2002'
    ) {
      return { ok: false, error: 'Ya existe un deportista con ese documento' };
    }
    return { ok: false, error: 'Error al crear el deportista' };
  }
}

export async function updateAthlete(
  input: AthleteUpdateInput
): Promise<ActionResult> {
  const session = await requireRole([
    Role.COACH,
    Role.CLUB_ADMIN,
    Role.SUPER_ADMIN
  ]);

  const parsed = athleteUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }

  const existing = await db.athlete.findUnique({
    where: { id: parsed.data.id },
    select: { clubId: true }
  });
  if (!existing) return { ok: false, error: 'Deportista no encontrado' };
  if (
    !canManageClub(session.user.role, session.user.clubId, existing.clubId)
  ) {
    return { ok: false, error: 'No tienes permiso sobre este deportista' };
  }

  const { id, ...rest } = parsed.data;
  await db.athlete.update({ where: { id }, data: rest });
  revalidatePath('/deportistas');
  revalidatePath(`/deportistas/${id}`);
  return { ok: true, data: { id } };
}

export async function deactivateAthlete(id: string): Promise<ActionResult> {
  return updateAthlete({ id, active: false });
}

/**
 * List athletes who don't yet have a User account linked. Used by the
 * /admin/atletas-sin-cuenta rescue page to invite them so they can
 * capture their own scores (Fase 6).
 */
export async function listAthletesWithoutAccount() {
  const session = await requireRole([Role.SUPER_ADMIN, Role.CLUB_ADMIN]);

  const where: Record<string, unknown> = { userId: null, active: true };
  if (session.user.role !== Role.SUPER_ADMIN) {
    where.clubId = session.user.clubId;
  }

  const rows = await db.athlete.findMany({
    where,
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      documentId: true,
      clubId: true,
      club: { select: { name: true } }
    }
  });

  // Also return pending invitations per athlete, so the UI can show
  // "already invited" state and the activation link if email failed.
  const pending = await db.invitation.findMany({
    where: { athleteId: { in: rows.map((r) => r.id) } },
    select: { athleteId: true, email: true, expiresAt: true }
  });
  const pendingByAthlete = new Map<string, { email: string; expiresAt: Date }>();
  for (const p of pending) {
    if (p.athleteId) pendingByAthlete.set(p.athleteId, { email: p.email, expiresAt: p.expiresAt });
  }

  return rows.map((r) => ({
    ...r,
    pendingInvitation: pendingByAthlete.get(r.id) ?? null
  }));
}

/**
 * Issue an invitation to an Athlete record so they can create a User
 * account that will be linked back to the existing Athlete via the
 * extended Invitation.athleteId field (consumed in acceptInvitation).
 *
 * Reuses the standard invite token + email flow (Resend or console).
 */
export async function inviteAthleteUser(
  athleteId: string,
  email: string
): Promise<ActionResult<{ link: string; emailProvider: 'resend' | 'console' | 'failed' }>> {
  const session = await requireRole([Role.SUPER_ADMIN, Role.CLUB_ADMIN]);

  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: 'Email inválido' };
  }

  const athlete = await db.athlete.findUnique({
    where: { id: athleteId },
    select: { id: true, userId: true, clubId: true, firstName: true, lastName: true }
  });
  if (!athlete) return { ok: false, error: 'Deportista no encontrado' };
  if (athlete.userId) {
    return { ok: false, error: 'Este deportista ya tiene cuenta vinculada' };
  }
  if (!canManageClub(session.user.role, session.user.clubId, athlete.clubId)) {
    return { ok: false, error: 'Sin permiso sobre este deportista' };
  }

  const existingUser = await db.user.findUnique({
    where: { email: trimmed },
    select: { id: true }
  });
  if (existingUser) {
    return { ok: false, error: 'Ya existe un usuario con ese email' };
  }

  // Replace any pending invitation for this athlete (one active at a time).
  await db.invitation.deleteMany({ where: { athleteId } });

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.invitation.create({
    data: {
      email: trimmed,
      role: Role.ATHLETE,
      clubId: athlete.clubId,
      athleteId,
      token,
      expiresAt
    }
  });

  const club = await db.club.findUnique({
    where: { id: athlete.clubId },
    select: { name: true }
  });
  const link = buildInvitationLink(token);
  const sendResult = await sendEmail(
    invitationEmail({
      to: trimmed,
      role: Role.ATHLETE,
      clubName: club?.name ?? 'tu club',
      link,
      expiresInDays: INVITE_TTL_DAYS
    })
  );
  const emailProvider: 'resend' | 'console' | 'failed' = sendResult.ok
    ? sendResult.provider
    : 'failed';

  revalidatePath('/admin/atletas-sin-cuenta');
  revalidatePath('/admin/usuarios');
  return { ok: true, data: { link, emailProvider } };
}
