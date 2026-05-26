'use server';

import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { canManageClub, requireRole, requireSession } from '@/lib/rbac';
import {
  coachOnboardingSchema,
  invitationAcceptSchema,
  invitationCreateSchema,
  type CoachOnboardingInput,
  type InvitationAcceptInput,
  type InvitationCreateInput
} from '@/lib/validation/invitation';
import type { ActionResult } from './athletes';
import type {
  PendingInvitation,
  InvitationLookup
} from './invitation-types';
import {
  BCRYPT_ROUNDS,
  INVITE_TTL_DAYS,
  buildInvitationLink,
  canInvite,
  generateInviteToken
} from './invitation-helpers';
import { sendEmail } from '@/lib/email/send';
import { invitationEmail } from '@/lib/email/templates';

export async function createInvitation(
  input: InvitationCreateInput
): Promise<
  ActionResult<{
    id: string;
    link: string;
    emailProvider: 'resend' | 'console' | 'failed';
  }>
> {
  const session = await requireRole([
    Role.SUPER_ADMIN,
    Role.CLUB_ADMIN,
    Role.COACH
  ]);

  const parsed = invitationCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }
  const data = parsed.data;

  if (!canInvite(session.user.role, session.user.clubId, data.role, data.clubId)) {
    return { ok: false, error: 'Sin permiso para invitar a ese rol o club' };
  }

  // Block re-invite when an active account already exists with that email.
  const existingUser = await db.user.findUnique({
    where: { email: data.email },
    select: { id: true }
  });
  if (existingUser) {
    return { ok: false, error: 'Ya existe un usuario con ese email' };
  }

  // Verify club exists (defense in depth — Zod only checks cuid format)
  const club = await db.club.findUnique({
    where: { id: data.clubId },
    select: { id: true }
  });
  if (!club) return { ok: false, error: 'Club no encontrado' };

  const token = generateInviteToken();
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  const invitation = await db.invitation.create({
    data: {
      email: data.email,
      role: data.role,
      clubId: data.clubId,
      token,
      expiresAt
    },
    select: { id: true }
  });

  const link = buildInvitationLink(token);

  // Fire-and-await email; sendEmail never throws, so an SMTP outage
  // doesn't roll back the invitation. The link is also returned to the
  // admin so they can share it manually if email fails.
  const clubForEmail = await db.club.findUnique({
    where: { id: data.clubId },
    select: { name: true }
  });
  const sendResult = await sendEmail(
    invitationEmail({
      to: data.email,
      role: data.role,
      clubName: clubForEmail?.name ?? 'tu club',
      link,
      expiresInDays: INVITE_TTL_DAYS
    })
  );
  const emailProvider: 'resend' | 'console' | 'failed' = sendResult.ok
    ? sendResult.provider
    : 'failed';

  console.log(
    `[INVITE] ${data.email} (${data.role}) → ${link} [email:${emailProvider}]`
  );

  revalidatePath('/admin/usuarios');
  return { ok: true, data: { id: invitation.id, link, emailProvider } };
}

export async function listInvitations(): Promise<PendingInvitation[]> {
  const session = await requireRole([
    Role.SUPER_ADMIN,
    Role.CLUB_ADMIN,
    Role.COACH
  ]);

  const where =
    session.user.role === Role.SUPER_ADMIN
      ? {}
      : { clubId: session.user.clubId ?? '__none__' };

  const rows = await db.invitation.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      createdAt: true,
      club: { select: { name: true } }
    }
  });

  const now = new Date();
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    clubName: r.club.name,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
    expired: r.expiresAt < now
  }));
}

export async function revokeInvitation(id: string): Promise<ActionResult> {
  const session = await requireRole([
    Role.SUPER_ADMIN,
    Role.CLUB_ADMIN,
    Role.COACH
  ]);

  const inv = await db.invitation.findUnique({
    where: { id },
    select: { clubId: true }
  });
  if (!inv) return { ok: false, error: 'Invitación no encontrada' };
  if (!canManageClub(session.user.role, session.user.clubId, inv.clubId)) {
    return { ok: false, error: 'Sin permiso sobre esta invitación' };
  }

  await db.invitation.delete({ where: { id } });
  revalidatePath('/admin/usuarios');
  return { ok: true, data: null };
}

// ── Public actions: NO auth required (the user has the token, not a session) ─

export async function getInvitationByToken(
  token: string
): Promise<InvitationLookup | null> {
  if (!token || token.length < 16) return null;
  const inv = await db.invitation.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      role: true,
      expiresAt: true,
      club: { select: { name: true } }
    }
  });
  if (!inv) return null;
  if (inv.expiresAt < new Date()) return null;
  return {
    id: inv.id,
    email: inv.email,
    role: inv.role,
    clubName: inv.club.name,
    expiresAt: inv.expiresAt
  };
}

export async function acceptInvitation(
  input: InvitationAcceptInput
): Promise<ActionResult<{ email: string }>> {
  const parsed = invitationAcceptSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }
  const { token, password, firstName, lastName } = parsed.data;

  const inv = await db.invitation.findUnique({
    where: { token },
    select: {
      id: true,
      email: true,
      role: true,
      clubId: true,
      athleteId: true,
      expiresAt: true
    }
  });
  if (!inv) return { ok: false, error: 'Invitación no encontrada' };
  if (inv.expiresAt < new Date()) {
    return { ok: false, error: 'La invitación ha expirado' };
  }

  // Coach role requires firstName + lastName to materialize the Coach profile
  // in the same transaction. For ATHLETE / CLUB_ADMIN we just create the User.
  if (inv.role === Role.COACH && (firstName === undefined || lastName === undefined)) {
    return {
      ok: false,
      error: 'Coach requiere nombre y apellido',
      fieldErrors: {
        firstName: firstName ? [] : ['Requerido'],
        lastName: lastName ? [] : ['Requerido']
      }
    };
  }

  // Edge case: an account may have been created between the check and now.
  const existingUser = await db.user.findUnique({
    where: { email: inv.email },
    select: { id: true }
  });
  if (existingUser) {
    return { ok: false, error: 'Ya existe un usuario con ese email' };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: inv.email,
        passwordHash,
        role: inv.role,
        active: true,
        clubId: inv.clubId
      },
      select: { id: true }
    });

    if (inv.role === Role.COACH) {
      await tx.coach.create({
        data: {
          userId: user.id,
          clubId: inv.clubId,
          firstName: firstName!,
          lastName: lastName!
        }
      });
    }

    // If this invitation was issued to link an existing athlete record
    // (Fase 6 rescue flow), wire the User to the Athlete here.
    if (inv.athleteId) {
      await tx.athlete.update({
        where: { id: inv.athleteId },
        data: { userId: user.id }
      });
    }

    // Consume the invitation (one-shot).
    await tx.invitation.delete({ where: { id: inv.id } });
  });

  revalidatePath('/admin/usuarios');
  return { ok: true, data: { email: inv.email } };
}

// ── Coach onboarding ─────────────────────────────────────────────────────────

export async function completeCoachProfile(
  input: CoachOnboardingInput
): Promise<ActionResult<{ id: string }>> {
  const session = await requireSession();

  if (session.user.role !== Role.COACH) {
    return {
      ok: false,
      error: 'Solo coaches pueden completar este perfil'
    };
  }
  if (!session.user.clubId) {
    return {
      ok: false,
      error: 'Tu usuario no está vinculado a ningún club'
    };
  }

  const parsed = coachOnboardingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }

  const existing = await db.coach.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });
  if (existing) return { ok: true, data: { id: existing.id } };

  const coach = await db.coach.create({
    data: {
      userId: session.user.id,
      clubId: session.user.clubId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName
    },
    select: { id: true }
  });

  revalidatePath('/');
  revalidatePath('/equipo');
  return { ok: true, data: coach };
}

/**
 * Helper: does the current session belong to a COACH who has not yet
 * materialized their Coach profile? Used by /(app)/layout.tsx and /page.tsx.
 */
export async function needsCoachOnboarding(): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  if (session.user.role !== Role.COACH) return false;
  const coach = await db.coach.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });
  return !coach;
}
