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
import {
  canAthleteEdit,
  canStaffEditPostCompletion,
  isSessionComplete
} from '@/lib/analytics/session-completion';

/**
 * Save (replace) the arrows for a (session, distance) ScoreSet.
 *
 * Strategy: we delete all arrows for the score set and re-insert.
 * Simpler than diff-and-patch, acceptable for MVP score volumes (≤120 arrows).
 */
export async function saveScoreSet(
  input: ScoreSetSaveInput
): Promise<
  ActionResult<{
    scoreSetId: string;
    arrowsSaved: number;
    nowCompleted: boolean;
  }>
> {
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

  // Load session + score set ownership + completion state.
  const ts = await db.trainingSession.findUnique({
    where: { id: data.sessionId },
    select: {
      id: true,
      completedAt: true,
      athlete: { select: { clubId: true, userId: true } },
      scoreSets: {
        select: {
          distance: true,
          endsCount: true,
          arrowsPerEnd: true,
          _count: { select: { arrows: true } }
        }
      }
    }
  });
  if (!ts) return { ok: false, error: 'Sesión no encontrada' };

  const isStaff = session.user.role !== Role.ATHLETE;

  if (session.user.role === Role.ATHLETE) {
    if (ts.athlete.userId !== session.user.id) {
      return { ok: false, error: 'Sin permiso sobre esta sesión' };
    }
    if (!canAthleteEdit(ts.completedAt)) {
      return { ok: false, error: 'La ventana de edición ha expirado' };
    }
  } else {
    if (!canManageClub(session.user.role, session.user.clubId, ts.athlete.clubId)) {
      return { ok: false, error: 'Sin permiso sobre esta sesión' };
    }
    if (ts.completedAt === null) {
      return {
        ok: false,
        error: 'Solo el deportista puede capturar durante la sesión'
      };
    }
    if (!canStaffEditPostCompletion(ts.completedAt)) {
      return { ok: false, error: 'La ventana de 24h ha expirado' };
    }
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
          isMiss: dec.isMiss,
          // x/y persisted only when the athlete tapped the target;
          // null for button-grid captures.
          targetX: a.targetX ?? null,
          targetY: a.targetY ?? null
        };
      })
    });

    // Recompute completion only when an athlete is saving (staff edits in
    // correction mode must not flip the timestamp).
    let nowCompleted = false;
    if (!isStaff && ts.completedAt === null) {
      const summary = ts.scoreSets.map((s) => ({
        endsCount: s.endsCount,
        arrowsPerEnd: s.arrowsPerEnd,
        arrowCount:
          s.distance === data.distance ? data.arrows.length : s._count.arrows
      }));
      if (isSessionComplete(summary)) {
        await tx.trainingSession.update({
          where: { id: data.sessionId },
          data: { completedAt: new Date() }
        });
        nowCompleted = true;
      }
    }

    return {
      scoreSetId: scoreSet.id,
      arrowsSaved: data.arrows.length,
      nowCompleted
    };
  });

  revalidatePath(`/sesion/${data.sessionId}`);
  revalidatePath(`/sesion/${data.sessionId}/puntuacion`);
  revalidatePath('/equipo');
  revalidatePath('/mi-progreso');
  return { ok: true, data: result };
}
