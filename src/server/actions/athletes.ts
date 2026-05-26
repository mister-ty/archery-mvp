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
