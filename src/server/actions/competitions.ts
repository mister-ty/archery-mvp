'use server';

import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { db } from '@/lib/db';
import { canManageClub, requireRole, requireSession } from '@/lib/rbac';
import {
  competitionCreateSchema,
  type CompetitionCreateInput
} from '@/lib/validation/competition';
import type { ActionResult } from './athletes';

/**
 * RBAC for competition entries:
 *  - SUPER_ADMIN: any athlete
 *  - CLUB_ADMIN / COACH: athletes of their own club
 *  - ATHLETE: only own competitions
 */
async function assertCanManageAthlete(athleteId: string): Promise<
  | { ok: true; userId: string }
  | { ok: false; error: string }
> {
  const session = await requireSession();
  const athlete = await db.athlete.findUnique({
    where: { id: athleteId },
    select: { clubId: true, userId: true }
  });
  if (!athlete) return { ok: false, error: 'Deportista no encontrado' };

  if (session.user.role === Role.ATHLETE) {
    if (athlete.userId !== session.user.id) {
      return { ok: false, error: 'Sin permiso sobre este deportista' };
    }
  } else if (
    !canManageClub(session.user.role, session.user.clubId, athlete.clubId)
  ) {
    return { ok: false, error: 'Sin permiso sobre este deportista' };
  }
  return { ok: true, userId: session.user.id };
}

export async function createCompetition(
  input: CompetitionCreateInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = competitionCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }
  const data = parsed.data;

  const auth = await assertCanManageAthlete(data.athleteId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const created = await db.competition.create({
    data: {
      athleteId: data.athleteId,
      createdById: auth.userId,
      name: data.name,
      date: data.date,
      type: data.type,
      location: data.location ?? null,
      totalScore: data.totalScore,
      rank: data.rank ?? null,
      xCount: data.xCount ?? null,
      notes: data.notes ?? null
    },
    select: { id: true }
  });

  revalidatePath(`/deportistas/${data.athleteId}`);
  revalidatePath(`/deportistas/${data.athleteId}/competiciones`);
  return { ok: true, data: created };
}

export async function listAthleteCompetitions(athleteId: string) {
  await requireRole([
    Role.SUPER_ADMIN,
    Role.CLUB_ADMIN,
    Role.COACH,
    Role.ATHLETE
  ]);
  const auth = await assertCanManageAthlete(athleteId);
  if (!auth.ok) return [];

  return db.competition.findMany({
    where: { athleteId },
    orderBy: { date: 'desc' },
    select: {
      id: true,
      name: true,
      date: true,
      type: true,
      location: true,
      totalScore: true,
      rank: true,
      xCount: true,
      notes: true
    }
  });
}

export async function deleteCompetition(id: string): Promise<ActionResult> {
  const session = await requireSession();
  const comp = await db.competition.findUnique({
    where: { id },
    select: {
      athleteId: true,
      createdById: true,
      athlete: { select: { clubId: true, userId: true } }
    }
  });
  if (!comp) return { ok: false, error: 'Competición no encontrada' };

  // Allow delete by: original creator, club staff that can manage the
  // athlete, or super admin.
  const isCreator = comp.createdById === session.user.id;
  const isStaff =
    session.user.role !== Role.ATHLETE &&
    canManageClub(session.user.role, session.user.clubId, comp.athlete.clubId);
  if (!isCreator && !isStaff) {
    return { ok: false, error: 'Sin permiso para borrar esta competición' };
  }

  await db.competition.delete({ where: { id } });
  revalidatePath(`/deportistas/${comp.athleteId}`);
  revalidatePath(`/deportistas/${comp.athleteId}/competiciones`);
  return { ok: true, data: null };
}
