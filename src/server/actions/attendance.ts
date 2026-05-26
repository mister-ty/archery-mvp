'use server';

import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { db } from '@/lib/db';
import { canManageClub, requireRole } from '@/lib/rbac';
import {
  attendanceUpdateSchema,
  type AttendanceUpdateInput
} from '@/lib/validation/attendance';
import type { ActionResult } from './athletes';

/**
 * Upsert attendance for a single TrainingSession.
 * Authorization: staff that can manage the athlete's club.
 */
export async function updateAttendance(
  input: AttendanceUpdateInput
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole([
    Role.COACH,
    Role.CLUB_ADMIN,
    Role.SUPER_ADMIN
  ]);

  const parsed = attendanceUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }
  const { sessionId, status, reason } = parsed.data;

  const trainingSession = await db.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      athleteId: true,
      sessionGroupId: true,
      athlete: { select: { clubId: true } }
    }
  });
  if (!trainingSession) {
    return { ok: false, error: 'Sesión no encontrada' };
  }
  if (
    !canManageClub(
      session.user.role,
      session.user.clubId,
      trainingSession.athlete.clubId
    )
  ) {
    return { ok: false, error: 'Sin permiso sobre esta sesión' };
  }

  const cleanReason =
    status === 'PRESENT' ? null : reason && reason.length > 0 ? reason : null;

  const upserted = await db.attendance.upsert({
    where: { sessionId },
    create: {
      sessionId,
      athleteId: trainingSession.athleteId,
      status,
      reason: cleanReason
    },
    update: {
      status,
      reason: cleanReason
    },
    select: { id: true }
  });

  revalidatePath(`/sesion/${sessionId}`);
  revalidatePath('/equipo');
  return { ok: true, data: upserted };
}

export async function getSessionAttendance(sessionId: string) {
  await requireRole([
    Role.COACH,
    Role.CLUB_ADMIN,
    Role.SUPER_ADMIN,
    Role.ATHLETE
  ]);

  return db.attendance.findUnique({
    where: { sessionId },
    select: { id: true, status: true, reason: true }
  });
}

export type GroupAttendanceRow = {
  sessionId: string;
  athleteId: string;
  athleteName: string;
  status: 'PRESENT' | 'ABSENT' | 'JUSTIFIED' | 'LATE' | null;
  reason: string | null;
};

/**
 * For a SessionGroup, return one row per sibling TrainingSession with
 * its current attendance (or null if not yet registered).
 */
export async function getGroupAttendance(
  sessionGroupId: string
): Promise<GroupAttendanceRow[]> {
  const session = await requireRole([
    Role.COACH,
    Role.CLUB_ADMIN,
    Role.SUPER_ADMIN
  ]);

  const rows = await db.trainingSession.findMany({
    where: { sessionGroupId },
    orderBy: [
      { athlete: { lastName: 'asc' } },
      { athlete: { firstName: 'asc' } }
    ],
    select: {
      id: true,
      athlete: {
        select: { id: true, firstName: true, lastName: true, clubId: true }
      },
      attendance: { select: { status: true, reason: true } }
    }
  });

  // Filter by club permissions (super admin sees all; others only their club).
  const visible = rows.filter((r) =>
    canManageClub(session.user.role, session.user.clubId, r.athlete.clubId)
  );

  return visible.map((r) => ({
    sessionId: r.id,
    athleteId: r.athlete.id,
    athleteName: `${r.athlete.firstName} ${r.athlete.lastName}`,
    status: r.attendance?.status ?? null,
    reason: r.attendance?.reason ?? null
  }));
}
