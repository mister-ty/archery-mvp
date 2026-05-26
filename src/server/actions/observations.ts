'use server';

import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import type { ActionResult } from './athletes';

const observationCreateSchema = z.object({
  sessionId: z.string().cuid(),
  content: z.string().min(1, 'El contenido no puede estar vacío').max(2000),
  tagIds: z.array(z.string().cuid()).max(10)
});

const observationUpdateSchema = z.object({
  id: z.string().cuid(),
  content: z.string().min(1).max(2000),
  tagIds: z.array(z.string().cuid()).max(10)
});

export async function createObservation(
  input: z.infer<typeof observationCreateSchema>
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole([Role.COACH, Role.CLUB_ADMIN, Role.SUPER_ADMIN]);

  const parsed = observationCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const coach = await db.coach.findFirst({
    where: { userId: session.user.id },
    select: { id: true }
  });
  if (!coach) return { ok: false, error: 'Solo coaches pueden crear observaciones' };

  const trainingSession = await db.trainingSession.findUnique({
    where: { id: parsed.data.sessionId },
    select: { id: true }
  });
  if (!trainingSession) return { ok: false, error: 'Sesión no encontrada' };

  const now = new Date();
  const editableUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const obs = await db.coachObservation.create({
    data: {
      sessionId: parsed.data.sessionId,
      coachId: coach.id,
      content: parsed.data.content,
      createdAt: now,
      editableUntil,
      tags: { connect: parsed.data.tagIds.map((id) => ({ id })) }
    },
    select: { id: true }
  });

  revalidatePath(`/sesion/${parsed.data.sessionId}`);
  return { ok: true, data: obs };
}

export async function updateObservation(
  input: z.infer<typeof observationUpdateSchema>
): Promise<ActionResult> {
  const session = await requireRole([Role.COACH, Role.CLUB_ADMIN, Role.SUPER_ADMIN]);

  const parsed = observationUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Datos inválidos' };
  }

  const coach = await db.coach.findFirst({
    where: { userId: session.user.id },
    select: { id: true }
  });
  if (!coach) return { ok: false, error: 'Solo coaches pueden editar observaciones' };

  const obs = await db.coachObservation.findUnique({
    where: { id: parsed.data.id },
    select: { coachId: true, editableUntil: true, sessionId: true }
  });
  if (!obs) return { ok: false, error: 'Observación no encontrada' };
  if (obs.coachId !== coach.id) return { ok: false, error: 'Solo el autor puede editar' };
  if (new Date() > obs.editableUntil) {
    return { ok: false, error: 'La ventana de edición de 24h ha expirado' };
  }

  await db.coachObservation.update({
    where: { id: parsed.data.id },
    data: {
      content: parsed.data.content,
      tags: {
        set: parsed.data.tagIds.map((id) => ({ id }))
      }
    }
  });

  revalidatePath(`/sesion/${obs.sessionId}`);
  return { ok: true, data: null };
}

export async function getSessionObservations(sessionId: string) {
  await requireRole([Role.COACH, Role.CLUB_ADMIN, Role.SUPER_ADMIN, Role.ATHLETE]);

  return db.coachObservation.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      content: true,
      createdAt: true,
      editableUntil: true,
      coach: { select: { id: true, firstName: true, lastName: true, userId: true } },
      tags: { select: { id: true, name: true } }
    }
  });
}

export async function getAllObservationTags() {
  return db.observationTag.findMany({ orderBy: { name: 'asc' } });
}
