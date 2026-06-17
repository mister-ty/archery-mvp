import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Role } from '@prisma/client';
import { ChevronLeft, Lock, Target, Users } from 'lucide-react';
import { auth } from '@/lib/auth';
import { getSessionForScoring } from '@/server/actions/sessions';
import { getSessionObservations, getAllObservationTags } from '@/server/actions/observations';
import {
  getSessionAttendance,
  getGroupAttendance
} from '@/server/actions/attendance';
import {
  canAthleteEdit,
  canStaffEditPostCompletion,
  editableUntil
} from '@/lib/analytics/session-completion';
import { ObservationForm } from '@/components/observations/ObservationForm';
import { ObservationList } from '@/components/observations/ObservationList';
import { AttendanceToggle } from '@/components/sessions/AttendanceToggle';
import { GroupAttendanceList } from '@/components/sessions/GroupAttendanceList';
import { SessionProgressLive } from '@/components/sessions/SessionProgressLive';
import { CoachLiveScoreSets } from '@/components/sessions/CoachLiveScoreSets';
import { Avatar } from '@/components/ui/avatar';
import { SectionHeader } from '@/components/ui/page-header';
import { SESSION_TYPE_LABEL } from '@/lib/session-labels';

function formatEditableUntil(d: Date): string {
  return d.toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default async function SessionDetailPage({
  params
}: {
  params: { id: string };
}) {
  const [session, authSession] = await Promise.all([
    getSessionForScoring(params.id),
    auth()
  ]);

  if (!session) notFound();

  const isStaff =
    authSession?.user?.role === Role.COACH ||
    authSession?.user?.role === Role.CLUB_ADMIN ||
    authSession?.user?.role === Role.SUPER_ADMIN;
  const isOwnerAthlete =
    !!authSession?.user?.id &&
    authSession.user.id === session.athlete.userId;

  const completedAt = session.completedAt;
  const isComplete = !!completedAt;
  const staffInWindow = canStaffEditPostCompletion(completedAt);
  const athleteCanEdit = canAthleteEdit(completedAt);
  const canEditScores =
    (isOwnerAthlete && athleteCanEdit) || (isStaff && staffInWindow);
  const until = editableUntil(completedAt);

  // Initial progress snapshot for live polling (computed from already-loaded data).
  let initialArrows = 0;
  let initialTotal = 0;
  let lastArrowDate: Date | null = null;
  for (const ss of session.scoreSets) {
    initialTotal += ss.endsCount * ss.arrowsPerEnd;
    initialArrows += ss.arrows.length;
    for (const a of ss.arrows) {
      if (!lastArrowDate || a.createdAt > lastArrowDate) {
        lastArrowDate = a.createdAt;
      }
    }
  }

  const [observations, allTags, attendance, groupAttendance] = await Promise.all([
    getSessionObservations(params.id),
    isStaff ? getAllObservationTags() : Promise.resolve([]),
    getSessionAttendance(params.id),
    isStaff && session.sessionGroupId
      ? getGroupAttendance(session.sessionGroupId)
      : Promise.resolve([])
  ]);

  const currentUserId = authSession?.user?.id ?? null;
  const isGroup = !!session.sessionGroupId;

  const fullName = `${session.athlete.firstName} ${session.athlete.lastName}`;
  const typeLabel = SESSION_TYPE_LABEL[session.type] ?? session.type;

  return (
    <div className="space-y-6">
      <Link
        href={`/deportistas/${session.athlete.id}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" />
        {fullName}
      </Link>

      {/* Hero band */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-card">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={fullName} size="md" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              Sesión · {typeLabel}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {fullName}
            </h1>
            <p className="text-xs text-muted-foreground">
              {new Date(session.date).toLocaleString('es-CO', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
              })}
              {isGroup && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info">
                  <Users className="h-3 w-3" />
                  Grupal
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Status banner */}
      {isStaff && !isComplete && (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-start gap-2">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold">Sesión en progreso</p>
              <p className="text-xs text-muted-foreground">
                Solo el deportista puede capturar mientras la sesión está activa. Podrás corregir
                durante 24 horas después de que la cierre.
              </p>
            </div>
          </div>
        </div>
      )}
      {!isStaff && !isComplete && (
        <SessionProgressLive
          sessionId={session.id}
          initial={{
            arrows: initialArrows,
            total: initialTotal,
            lastUpdatedAt: lastArrowDate ? lastArrowDate.toISOString() : null,
            completedAt: null
          }}
        />
      )}
      {isStaff && isComplete && staffInWindow && until && (
        <div className="rounded-xl border border-info/40 bg-info/10 p-3 text-sm">
          <span className="font-medium">Modo corrección</span>
          <span className="text-muted-foreground"> · puedes editar hasta el {formatEditableUntil(until)}</span>
        </div>
      )}
      {isStaff && isComplete && !staffInWindow && (
        <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
          Sesión cerrada. La ventana de corrección expiró.
        </div>
      )}
      {isOwnerAthlete && isComplete && athleteCanEdit && until && (
        <div className="rounded-xl border border-info/40 bg-info/10 p-3 text-sm">
          Tu sesión está cerrada. Puedes corregir hasta el {formatEditableUntil(until)}.
        </div>
      )}

      {/* Score sets — live view for staff while the session is active,
          standard cards (read-only or editable) otherwise. */}
      <section>
        <SectionHeader
          title="Puntuaciones"
          description={
            isStaff && !isComplete
              ? 'Vista en vivo · solo lectura mientras el deportista captura'
              : undefined
          }
        />
        {isStaff && !isComplete ? (
          <CoachLiveScoreSets
            sessionId={session.id}
            initial={{
              completedAt: null,
              scoreSets: session.scoreSets.map((ss) => ({
                id: ss.id,
                distance: ss.distance,
                endsCount: ss.endsCount,
                arrowsPerEnd: ss.arrowsPerEnd,
                arrows: ss.arrows.map((a) => ({
                  endNumber: a.endNumber,
                  arrowNumber: a.arrowNumber,
                  score: a.score,
                  isX: a.isX,
                  isMiss: a.isMiss,
                  targetX: a.targetX ?? null,
                  targetY: a.targetY ?? null
                }))
              }))
            }}
          />
        ) : (
        <div className="space-y-2">
          {session.scoreSets.map((ss) => {
            const total = ss.arrows.reduce((acc, a) => acc + (a.isMiss ? 0 : a.score), 0);
            const done = ss.arrows.length;
            const expected = ss.endsCount * ss.arrowsPerEnd;
            const progress = expected > 0 ? Math.min(100, (done / expected) * 100) : 0;

            const cardInner = (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
                      <Target className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{ss.distance}m</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {done}/{expected} flechas · total {total}
                      </p>
                    </div>
                  </div>
                  {canEditScores ? (
                    <span className="text-xs font-medium text-primary transition group-hover:translate-x-0.5">
                      {isStaff ? 'Corregir →' : 'Cargar →'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      Solo lectura
                    </span>
                  )}
                </div>
                <div className="mt-3 h-1 w-full overflow-hidden rounded bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </>
            );

            return canEditScores ? (
              <Link
                key={ss.id}
                href={`/sesion/${session.id}/puntuacion?distance=${ss.distance}`}
                className="group block rounded-xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover"
              >
                {cardInner}
              </Link>
            ) : (
              <div
                key={ss.id}
                className="rounded-xl border bg-card p-4 shadow-sm"
              >
                {cardInner}
              </div>
            );
          })}
        </div>
        )}
      </section>

      {/* Attendance (F9) — staff only */}
      {isStaff && (
        <section>
          <SectionHeader title="Asistencia" />
          {isGroup ? (
            <GroupAttendanceList rows={groupAttendance} />
          ) : (
            <div className="rounded-xl border bg-card p-4 shadow-card">
              <AttendanceToggle
                sessionId={params.id}
                initialStatus={attendance?.status ?? null}
                initialReason={attendance?.reason ?? null}
                athleteLabel={fullName}
              />
            </div>
          )}
        </section>
      )}

      {/* Observations (F8) */}
      <section>
        <SectionHeader title="Observaciones del coach" />

        {isStaff && (
          <div className="mb-4 rounded-xl border bg-card p-4 shadow-card">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Nueva observación</p>
            <ObservationForm sessionId={params.id} allTags={allTags} />
          </div>
        )}

        <ObservationList
          observations={observations.map((o) => ({
            id: o.id,
            content: o.content,
            createdAt: o.createdAt,
            editableUntil: o.editableUntil,
            coachName: `${o.coach.firstName} ${o.coach.lastName}`,
            coachId: o.coach.id,
            coachUserId: o.coach.userId,
            tags: o.tags,
            sessionId: params.id
          }))}
          allTags={allTags}
          currentUserId={currentUserId}
        />
      </section>
    </div>
  );
}
