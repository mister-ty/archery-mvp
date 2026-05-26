'use server';

import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { db } from '@/lib/db';
import {
  sessionCreateSchema,
  type SessionCreateInput
} from '@/lib/validation/session';
import { requireRole, canManageClub } from '@/lib/rbac';
import type { ActionResult } from './athletes';
import {
  athleteSelfSessionSchema,
  type AthleteSelfSessionInput
} from '@/lib/validation/athlete-self-session';
import {
  templateByKey,
  type AthleteSessionTemplate
} from '@/lib/scoring/athlete-self-templates';
import {
  canAthleteEdit,
  canStaffEditPostCompletion
} from '@/lib/analytics/session-completion';

/**
 * Create training session(s) — one per athlete.
 * If multiple athletes are provided, they share a SessionGroup.
 *
 * Returns the ids of created sessions (in athlete order).
 */
export async function createTrainingSession(
  input: SessionCreateInput
): Promise<ActionResult<{ sessionIds: string[]; sessionGroupId?: string }>> {
  const session = await requireRole([
    Role.COACH,
    Role.CLUB_ADMIN,
    Role.SUPER_ADMIN
  ]);

  const parsed = sessionCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors
    };
  }
  const data = parsed.data;

  // Validate athletes belong to a club the user can manage AND have a user account.
  // Without a user account the athlete cannot capture their own scores, which
  // is now required (coaches no longer capture during active sessions).
  const athletes = await db.athlete.findMany({
    where: { id: { in: data.athleteIds }, active: true },
    select: { id: true, clubId: true, userId: true, firstName: true, lastName: true }
  });
  if (athletes.length !== data.athleteIds.length) {
    return { ok: false, error: 'Algún deportista no existe o está inactivo' };
  }
  for (const a of athletes) {
    if (!canManageClub(session.user.role, session.user.clubId, a.clubId)) {
      return { ok: false, error: 'No tienes permiso sobre uno de los deportistas' };
    }
    if (!a.userId) {
      return {
        ok: false,
        error: `${a.firstName} ${a.lastName} no tiene cuenta de usuario. Invítalo primero desde "Atletas sin cuenta".`
      };
    }
  }

  // Need coachId if the creator is a coach (for SessionGroup creator FK).
  // Club admins/super admins also need a coach link; for MVP we require
  // creator to have a coach profile to create grouped sessions.
  const isGroup = data.athleteIds.length > 1;
  let sessionGroupId: string | undefined;

  const result = await db.$transaction(async (tx) => {
    if (isGroup) {
      const coach = await tx.coach.findFirst({
        where: { userId: session.user.id },
        select: { id: true }
      });
      if (!coach) {
        throw new Error(
          'Solo un coach puede crear sesiones grupales en esta fase'
        );
      }
      const group = await tx.sessionGroup.create({
        data: {
          date: data.date,
          createdById: coach.id
        },
        select: { id: true }
      });
      sessionGroupId = group.id;
    }

    const sessionIds: string[] = [];
    for (const athleteId of data.athleteIds) {
      const created = await tx.trainingSession.create({
        data: {
          athleteId,
          sessionGroupId,
          date: data.date,
          type: data.type,
          indoor: data.indoor,
          weather: data.weather ?? null,
          weatherNotes: data.weatherNotes ?? null,
          createdById: session.user.id,
          scoreSets: {
            create: data.distances.map((distance) => ({
              distance,
              endsCount: 6,
              arrowsPerEnd: data.indoor ? 3 : 6
            }))
          }
        },
        select: { id: true }
      });
      sessionIds.push(created.id);
    }

    return { sessionIds };
  });

  revalidatePath('/equipo');
  revalidatePath('/mi-progreso');
  return { ok: true, data: { ...result, sessionGroupId } };
}

/**
 * Athlete creates their own training session from /mi-progreso/nueva-sesion.
 *
 * Only ATHLETE can call this. The athleteId is resolved from the JWT —
 * never trusted from input — to prevent cross-athlete writes. Coaches
 * stay on /sesion/nueva for multi-athlete scheduling.
 */
export async function createAthleteSelfSession(
  input: AthleteSelfSessionInput
): Promise<ActionResult<{ sessionId: string }>> {
  const session = await requireRole([Role.ATHLETE]);

  const parsed = athleteSelfSessionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Datos inválidos',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>
    };
  }
  const data = parsed.data;

  const athlete = await db.athlete.findFirst({
    where: { userId: session.user.id, active: true },
    select: { id: true }
  });
  if (!athlete) {
    return { ok: false, error: 'Tu cuenta no tiene un perfil de deportista vinculado' };
  }

  let resolved: {
    type: AthleteSessionTemplate['type'];
    indoor: boolean;
    scoreSets: AthleteSessionTemplate['scoreSets'];
  };
  if (data.mode === 'template') {
    const tpl = templateByKey(data.templateKey);
    if (!tpl) {
      return { ok: false, error: 'Plantilla desconocida' };
    }
    resolved = {
      type: tpl.type,
      indoor: tpl.indoor,
      scoreSets: [...tpl.scoreSets]
    };
  } else {
    resolved = {
      type: data.type,
      indoor: data.indoor,
      scoreSets: data.scoreSets
    };
  }

  const created = await db.trainingSession.create({
    data: {
      athleteId: athlete.id,
      date: new Date(),
      type: resolved.type,
      indoor: resolved.indoor,
      createdById: session.user.id,
      scoreSets: {
        create: resolved.scoreSets.map((s) => ({
          distance: s.distance,
          endsCount: s.endsCount,
          arrowsPerEnd: s.arrowsPerEnd
        }))
      }
    },
    select: { id: true }
  });

  revalidatePath('/mi-progreso');
  revalidatePath('/equipo');
  return { ok: true, data: { sessionId: created.id } };
}

export async function getSessionForScoring(sessionId: string) {
  const session = await requireRole([
    Role.COACH,
    Role.CLUB_ADMIN,
    Role.SUPER_ADMIN,
    Role.ATHLETE
  ]);

  const ts = await db.trainingSession.findUnique({
    where: { id: sessionId },
    include: {
      athlete: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          clubId: true,
          userId: true
        }
      },
      scoreSets: {
        include: { arrows: { orderBy: [{ endNumber: 'asc' }, { arrowNumber: 'asc' }] } },
        orderBy: { distance: 'asc' }
      }
    }
  });

  if (!ts) return null;

  // Authorization: athlete can only see own; staff must share club.
  if (session.user.role === Role.ATHLETE) {
    if (ts.athlete.userId !== session.user.id) return null;
  } else if (
    !canManageClub(session.user.role, session.user.clubId, ts.athlete.clubId)
  ) {
    return null;
  }

  return ts;
}

/**
 * Strict wrapper for the /puntuacion page that decides if the caller can
 * actually capture/edit scores right now, or should be sent to read-only.
 *
 * Modes:
 *  - 'capture'           → athlete owns session and is within edit window (or it is active)
 *  - 'staff-correction'  → staff editing a completed session within 24h
 *  - 'denied'            → caller has no business being on the capture screen
 */
export async function getSessionForScoringStrict(sessionId: string) {
  const ts = await getSessionForScoring(sessionId);
  if (!ts) return { session: null, mode: 'denied' as const };

  const session = await requireRole([
    Role.COACH,
    Role.CLUB_ADMIN,
    Role.SUPER_ADMIN,
    Role.ATHLETE
  ]);

  if (session.user.role === Role.ATHLETE) {
    if (canAthleteEdit(ts.completedAt)) {
      return { session: ts, mode: 'capture' as const };
    }
    return { session: ts, mode: 'denied' as const };
  }

  // Staff: only allowed for corrections within the 24h post-completion window.
  if (canStaffEditPostCompletion(ts.completedAt)) {
    return { session: ts, mode: 'staff-correction' as const };
  }
  return { session: ts, mode: 'denied' as const };
}

/**
 * Lightweight snapshot of a session's capture progress, used by the coach's
 * live-progress polling component. Reuses the same RBAC guard as
 * getSessionForScoring (athlete must own; staff must share club).
 */
export async function getSessionProgressSnapshot(
  sessionId: string
): Promise<
  ActionResult<{
    arrows: number;
    total: number;
    lastUpdatedAt: string | null;
    completedAt: string | null;
  }>
> {
  const session = await requireRole([
    Role.COACH,
    Role.CLUB_ADMIN,
    Role.SUPER_ADMIN,
    Role.ATHLETE
  ]);

  const ts = await db.trainingSession.findUnique({
    where: { id: sessionId },
    select: {
      completedAt: true,
      athlete: { select: { clubId: true, userId: true } },
      scoreSets: {
        select: {
          endsCount: true,
          arrowsPerEnd: true,
          _count: { select: { arrows: true } }
        }
      }
    }
  });
  if (!ts) return { ok: false, error: 'Sesión no encontrada' };

  if (session.user.role === Role.ATHLETE) {
    if (ts.athlete.userId !== session.user.id) {
      return { ok: false, error: 'Sin permiso' };
    }
  } else if (
    !canManageClub(session.user.role, session.user.clubId, ts.athlete.clubId)
  ) {
    return { ok: false, error: 'Sin permiso' };
  }

  let arrows = 0;
  let total = 0;
  for (const set of ts.scoreSets) {
    total += set.endsCount * set.arrowsPerEnd;
    arrows += set._count.arrows;
  }

  const lastArrow =
    arrows > 0
      ? await db.arrow.findFirst({
          where: { scoreSet: { sessionId } },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true }
        })
      : null;

  return {
    ok: true,
    data: {
      arrows,
      total,
      lastUpdatedAt: lastArrow ? lastArrow.createdAt.toISOString() : null,
      completedAt: ts.completedAt ? ts.completedAt.toISOString() : null
    }
  };
}
