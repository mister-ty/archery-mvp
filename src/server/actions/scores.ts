'use server';

import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { db } from '@/lib/db';
import {
  scoreSetSaveSchema,
  decodeArrowValue,
  type ScoreSetSaveInput
} from '@/lib/validation/score';
import { requireRole, canManageClub } from '@/lib/rbac';
import type { ActionResult } from './athletes';

/**
 * Save (replace) the arrows for a (session, distance) ScoreSet.
 *
 * Strategy: we delete all arrows for the score set and re-insert.
 * Simpler than diff-and-patch, acceptable for MVP score volumes (≤120 arrows).
 */
export async function saveScoreSet(
  input: ScoreSetSaveInput
): Promise<ActionResult<{ scoreSetId: string; arrowsSaved: number }>> {
  const session = await requireRole([
    Role.COACH,
    Role.CLUB_ADMIN,
    Role.SUPER_ADMIN,
    Role.ATHLETE
  ]);

  const parsed = scoreSetSaveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }
  const data = parsed.data;

  // Load session + score set ownership
  const ts = await db.trainingSession.findUnique({
    where: { id: data.sessionId },
    select: {
      id: true,
      athlete: { select: { clubId: true, userId: true } }
    }
  });
  if (!ts) return { ok: false, error: 'Sesión no encontrada' };

  if (session.user.role === Role.ATHLETE) {
    if (ts.athlete.userId !== session.user.id) {
      return { ok: false, error: 'Sin permiso sobre esta sesión' };
    }
  } else if (
    !canManageClub(session.user.role, session.user.clubId, ts.athlete.clubId)
  ) {
    return { ok: false, error: 'Sin permiso sobre esta sesión' };
  }

  const result = await db.$transaction(async (tx) => {
    const scoreSet = await tx.scoreSet.upsert({
      where: {
        sessionId_distance: {
          sessionId: data.sessionId,
          distance: data.distance
        }
      },
      update: {
        endsCount: data.endsCount,
        arrowsPerEnd: data.arrowsPerEnd
      },
      create: {
        sessionId: data.sessionId,
        distance: data.distance,
        endsCount: data.endsCount,
        arrowsPerEnd: data.arrowsPerEnd
      },
      select: { id: true }
    });

    await tx.arrow.deleteMany({ where: { scoreSetId: scoreSet.id } });

    await tx.arrow.createMany({
      data: data.arrows.map((a) => {
        const dec = decodeArrowValue(a.value);
        return {
          scoreSetId: scoreSet.id,
          endNumber: a.endNumber,
          arrowNumber: a.arrowNumber,
          score: dec.score,
          isX: dec.isX,
          isMiss: dec.isMiss
        };
      })
    });

    return { scoreSetId: scoreSet.id, arrowsSaved: data.arrows.length };
  });

  revalidatePath(`/sesion/${data.sessionId}`);
  revalidatePath(`/sesion/${data.sessionId}/puntuacion`);
  return { ok: true, data: result };
}
