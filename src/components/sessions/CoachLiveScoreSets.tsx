'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Target } from 'lucide-react';
import {
  getSessionLiveScoreSets,
  type LiveScoreSet,
  type LiveScoreSetArrow
} from '@/server/actions/sessions';
import { InteractiveTarget } from '@/components/scoring/InteractiveTarget';
import type { ArrowValue } from '@/lib/validation/score';

const POLL_INTERVAL_MS = 5000;

type Props = {
  sessionId: string;
  initial: {
    completedAt: string | null;
    scoreSets: LiveScoreSet[];
  };
};

function arrowDisplayValue(a: LiveScoreSetArrow): string {
  if (a.isMiss) return 'M';
  if (a.isX) return 'X';
  return String(a.score);
}

function arrowToTargetHit(a: LiveScoreSetArrow): {
  x: number;
  y: number;
  value: ArrowValue;
} | null {
  if (a.targetX === null || a.targetY === null) return null;
  const v: ArrowValue = a.isMiss ? 'M' : a.isX ? 'X' : (a.score as ArrowValue);
  return { x: a.targetX, y: a.targetY, value: v };
}

function totalScore(arrows: LiveScoreSetArrow[]): number {
  return arrows.reduce((acc, a) => acc + (a.isMiss ? 0 : a.score), 0);
}

/**
 * Coach-only live view of a session's score sets. Polls every 5 s while
 * the session is active; stops polling once `completedAt` is set or the
 * tab is hidden. The matrices + targets are strictly read-only — staff
 * editing happens only after the athlete closes the session.
 */
export function CoachLiveScoreSets({ sessionId, initial }: Props) {
  const [snapshot, setSnapshot] = useState(initial);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const isActive = snapshot.completedAt === null;

  const tick = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    const res = await getSessionLiveScoreSets(sessionId);
    if (res.ok) {
      setSnapshot(res.data);
      setLastSyncAt(Date.now());
    }
  }, [sessionId]);

  useEffect(() => {
    if (!isActive) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    timerRef.current = setInterval(tick, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isActive, tick]);

  return (
    <div className="space-y-4">
      {isActive && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5 animate-pulse text-info" />
          Mirando en vivo · actualiza cada {POLL_INTERVAL_MS / 1000}s
          {lastSyncAt !== null && (
            <span className="ml-1 tabular-nums opacity-60">
              · sync hace {Math.max(0, Math.round((Date.now() - lastSyncAt) / 1000))}s
            </span>
          )}
        </p>
      )}

      {snapshot.scoreSets.map((ss) => {
        const captured = ss.arrows.length;
        const expected = ss.endsCount * ss.arrowsPerEnd;
        const score = totalScore(ss.arrows);
        const hits = ss.arrows
          .map(arrowToTargetHit)
          .filter((h): h is NonNullable<typeof h> => h !== null);

        // Build the ends × arrows matrix for this scoreSet.
        const matrix: Array<Array<LiveScoreSetArrow | null>> = [];
        for (let e = 1; e <= ss.endsCount; e++) {
          const row: Array<LiveScoreSetArrow | null> = [];
          for (let a = 1; a <= ss.arrowsPerEnd; a++) {
            row.push(
              ss.arrows.find(
                (x) => x.endNumber === e && x.arrowNumber === a
              ) ?? null
            );
          }
          matrix.push(row);
        }

        return (
          <div
            key={ss.id}
            className="rounded-2xl border bg-card p-4 shadow-card"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary">
                  <Target className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{ss.distance}m</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {captured}/{expected} flechas · total {score}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              {/* Ends matrix */}
              <div className="space-y-1.5">
                {matrix.map((row, eIdx) => {
                  const endNumber = eIdx + 1;
                  const endTotal = row.reduce(
                    (acc, a) => acc + (a && !a.isMiss ? a.score : 0),
                    0
                  );
                  return (
                    <div
                      key={endNumber}
                      className="rounded-lg border p-2"
                    >
                      <div className="mb-1 flex items-center justify-between px-1 text-[11px] text-muted-foreground">
                        <span>End {endNumber}</span>
                        <span className="tabular-nums">{endTotal}</span>
                      </div>
                      <div
                        className="grid gap-1"
                        style={{
                          gridTemplateColumns: `repeat(${ss.arrowsPerEnd}, minmax(0, 1fr))`
                        }}
                      >
                        {row.map((a, aIdx) => (
                          <div
                            key={aIdx}
                            className={
                              a
                                ? 'flex h-9 items-center justify-center rounded bg-muted text-sm font-bold tabular-nums'
                                : 'flex h-9 items-center justify-center rounded border border-dashed border-border/60 text-xs text-muted-foreground/40'
                            }
                          >
                            {a ? arrowDisplayValue(a) : aIdx + 1}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Read-only target with all dots from this scoreSet */}
              <div className="w-full sm:w-[280px]">
                <InteractiveTarget
                  hits={hits}
                  onTap={() => {
                    /* read-only */
                  }}
                  disabled
                  ariaLabel={`Diana ${ss.distance}m (solo lectura)`}
                />
                <p className="mt-1 text-center text-[10px] text-muted-foreground">
                  {hits.length} flechas en la diana
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
