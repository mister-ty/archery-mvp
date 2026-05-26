'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Crosshair, Grid3x3, Undo2, Save, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ArrowValue } from '@/lib/validation/score';
import { saveScoreSet } from '@/server/actions/scores';
import {
  clearBuffer,
  loadBuffer,
  markBufferSynced,
  saveBuffer
} from '@/lib/scoring/offline-buffer';
import {
  SyncStatusBadge,
  type SyncStatus
} from '@/components/scoring/SyncStatusBadge';
import {
  InteractiveTarget,
  type TargetHit
} from '@/components/scoring/InteractiveTarget';

const INPUT_MODE_KEY = 'archery.scoreInputMode';
type InputMode = 'buttons' | 'target';

const AUTOSAVE_DEBOUNCE_MS = 1500;

type ScoreSetInit = {
  id: string;
  sessionId: string;
  distance: number;
  endsCount: number;
  arrowsPerEnd: number;
  arrows: Array<{
    endNumber: number;
    arrowNumber: number;
    score: number;
    isX: boolean;
    isMiss: boolean;
  }>;
};

type Props = {
  scoreSet: ScoreSetInit;
  athleteName: string;
};

type Captured = { endNumber: number; arrowNumber: number; value: ArrowValue };

const SCORE_BUTTONS: { value: ArrowValue; label: string; tier: string }[] = [
  { value: 'X', label: 'X', tier: 'gold' },
  { value: 10, label: '10', tier: 'gold' },
  { value: 9, label: '9', tier: 'gold' },
  { value: 8, label: '8', tier: 'red' },
  { value: 7, label: '7', tier: 'red' },
  { value: 6, label: '6', tier: 'blue' },
  { value: 5, label: '5', tier: 'blue' },
  { value: 4, label: '4', tier: 'black' },
  { value: 3, label: '3', tier: 'black' },
  { value: 2, label: '2', tier: 'white' },
  { value: 1, label: '1', tier: 'white' },
  { value: 'M', label: 'M', tier: 'miss' }
];

const TIER_STYLES: Record<string, string> = {
  gold: 'bg-yellow-400 text-black hover:bg-yellow-500',
  red: 'bg-red-500 text-white hover:bg-red-600',
  blue: 'bg-blue-500 text-white hover:bg-blue-600',
  black: 'bg-zinc-800 text-white hover:bg-zinc-900',
  white: 'bg-zinc-100 text-zinc-900 border hover:bg-zinc-200',
  miss: 'bg-zinc-400 text-white hover:bg-zinc-500'
};

function encodeArrowFromDb(a: ScoreSetInit['arrows'][number]): ArrowValue {
  if (a.isMiss) return 'M';
  if (a.isX) return 'X';
  return a.score as ArrowValue;
}

function valueToScore(v: ArrowValue): number {
  if (v === 'X') return 10;
  if (v === 'M') return 0;
  return v;
}

export default function ScoreCapture({ scoreSet, athleteName }: Props) {
  const [isPending, startTransition] = useTransition();
  const [arrows, setArrows] = useState<Captured[]>(() =>
    scoreSet.arrows.map((a) => ({
      endNumber: a.endNumber,
      arrowNumber: a.arrowNumber,
      value: encodeArrowFromDb(a)
    }))
  );
  const [editingArrow, setEditingArrow] = useState<{
    end: number;
    arrow: number;
  } | null>(null);

  // ── Input mode (button grid vs interactive target) ─────────────────────
  // The user's preference persists across sessions in localStorage.
  // SSR-safe: starts with 'buttons' and rehydrates on mount.
  const [inputMode, setInputMode] = useState<InputMode>('buttons');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(INPUT_MODE_KEY);
    if (stored === 'buttons' || stored === 'target') setInputMode(stored);
  }, []);
  const switchInputMode = useCallback((next: InputMode) => {
    setInputMode(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(INPUT_MODE_KEY, next);
    }
  }, []);

  // ── Hit positions on the target (visual only — current end only) ───────
  // Stored as a Map keyed by `${end}-${arrow}` so editing a slot replaces
  // its dot. We don't persist these — refreshing the page drops them.
  // Adding x/y to the Arrow schema would be the v2.
  const [endHits, setEndHits] = useState<Map<string, TargetHit>>(new Map());

  // ── Offline / sync state ────────────────────────────────────────────────
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [isOnline, setIsOnline] = useState(true);
  // True until the first mount-time buffer hydration has run. We use this
  // to avoid auto-saving the freshly-loaded state right back to the server.
  const hydratedRef = useRef(false);
  // Skip the very first auto-persist tick. On initial mount the effect
  // would fire with `arrows` set to the server snapshot (stale closure)
  // even when the mount-hydration effect is about to setArrows(buffer),
  // and would overwrite a newer buffer with the stale value. The next
  // render — after either the user taps or the hydration restore — runs
  // the effect normally.
  const skipFirstPersistRef = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalArrows = scoreSet.endsCount * scoreSet.arrowsPerEnd;

  // ── Mount: hydrate from localStorage if a buffer exists ────────────────
  useEffect(() => {
    const buf = loadBuffer(scoreSet.sessionId, scoreSet.distance);
    if (buf && buf.arrows.length > 0) {
      // Prefer buffer when it has more arrows than the server snapshot,
      // OR when it is dirty (= changes not yet on the server).
      const serverCount = scoreSet.arrows.length;
      if (buf.dirty || buf.arrows.length > serverCount) {
        setArrows(
          buf.arrows.map((a) => ({
            endNumber: a.endNumber,
            arrowNumber: a.arrowNumber,
            value: a.value
          }))
        );
        setSyncStatus(buf.dirty ? 'pending' : 'synced');
      }
    }
    hydratedRef.current = true;
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Online/offline awareness ───────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // ── Reflect offline status in the badge when there is nothing to sync ──
  useEffect(() => {
    if (!isOnline) {
      setSyncStatus((prev) => (prev === 'saving' ? prev : 'offline'));
    } else {
      // Coming back online: if we have pending changes, trigger a save.
      setSyncStatus((prev) => (prev === 'offline' ? 'pending' : prev));
    }
  }, [isOnline]);

  // Shared save routine — used by auto-save and the manual button.
  async function performSave(currentArrows: Captured[], opts?: { manual?: boolean }) {
    if (currentArrows.length === 0) return;
    setSyncStatus('saving');
    try {
      const res = await saveScoreSet({
        sessionId: scoreSet.sessionId,
        distance: scoreSet.distance,
        endsCount: scoreSet.endsCount,
        arrowsPerEnd: scoreSet.arrowsPerEnd,
        arrows: currentArrows.map((a) => ({
          endNumber: a.endNumber,
          arrowNumber: a.arrowNumber,
          value: a.value
        }))
      });
      if (res.ok) {
        markBufferSynced(
          scoreSet.sessionId,
          scoreSet.distance,
          currentArrows.map((a) => ({
            endNumber: a.endNumber,
            arrowNumber: a.arrowNumber,
            value: a.value
          }))
        );
        setSyncStatus('synced');
        if (opts?.manual) {
          toast.success(`Guardado: ${res.data.arrowsSaved} flechas`);
        }
      } else {
        setSyncStatus('error');
        if (opts?.manual) toast.error(res.error);
      }
    } catch {
      // Network failure / server unreachable — keep buffer dirty for retry.
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
      if (opts?.manual) {
        toast.error('Sin conexión — guardado local solamente');
      }
    }
  }

  // ── Auto-persist + debounced auto-save on every arrow change ───────────
  useEffect(() => {
    if (skipFirstPersistRef.current) {
      skipFirstPersistRef.current = false;
      return;
    }
    if (!hydratedRef.current) return;

    saveBuffer({
      sessionId: scoreSet.sessionId,
      distance: scoreSet.distance,
      arrows: arrows.map((a) => ({
        endNumber: a.endNumber,
        arrowNumber: a.arrowNumber,
        value: a.value
      })),
      dirty: true,
      savedAt: null
    });
    setSyncStatus((prev) => (prev === 'saving' ? prev : isOnline ? 'pending' : 'offline'));

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!isOnline || arrows.length === 0) return;

    const snapshot = arrows;
    debounceRef.current = setTimeout(() => {
      performSave(snapshot);
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrows, isOnline]);

  // ── Coming back online with pending work → flush immediately ──────────
  useEffect(() => {
    if (isOnline && syncStatus === 'pending' && arrows.length > 0) {
      performSave(arrows);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // Determine next slot to capture
  const nextSlot = useMemo(() => {
    if (editingArrow) return editingArrow;
    if (arrows.length >= totalArrows) return null;
    const sorted = [...arrows].sort(
      (a, b) =>
        a.endNumber - b.endNumber || a.arrowNumber - b.arrowNumber
    );
    const last = sorted[sorted.length - 1];
    if (!last) return { end: 1, arrow: 1 };
    if (last.arrowNumber < scoreSet.arrowsPerEnd) {
      return { end: last.endNumber, arrow: last.arrowNumber + 1 };
    }
    if (last.endNumber < scoreSet.endsCount) {
      return { end: last.endNumber + 1, arrow: 1 };
    }
    return null;
  }, [arrows, editingArrow, scoreSet.arrowsPerEnd, scoreSet.endsCount, totalArrows]);

  const totalScore = useMemo(
    () => arrows.reduce((acc, a) => acc + valueToScore(a.value), 0),
    [arrows]
  );
  const average = arrows.length
    ? (totalScore / arrows.length).toFixed(2)
    : '—';
  const xCount = arrows.filter((a) => a.value === 'X').length;
  const tenCount = arrows.filter((a) => a.value === 10 || a.value === 'X')
    .length;

  function handleScore(value: ArrowValue) {
    if (!nextSlot) return;

    // haptic
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(15);
    }

    setArrows((prev) => {
      // remove any existing arrow in that slot (edit case)
      const filtered = prev.filter(
        (a) =>
          !(a.endNumber === nextSlot.end && a.arrowNumber === nextSlot.arrow)
      );
      return [
        ...filtered,
        { endNumber: nextSlot.end, arrowNumber: nextSlot.arrow, value }
      ];
    });
    setEditingArrow(null);
  }

  function handleTargetTap(hit: TargetHit) {
    if (!nextSlot) return;
    const key = `${nextSlot.end}-${nextSlot.arrow}`;
    setEndHits((prev) => {
      const next = new Map(prev);
      next.set(key, hit);
      return next;
    });
    handleScore(hit.value);
  }

  // Clear the visible hits whenever the current end changes — the dots
  // are a per-end annotation, not a persisted record.
  const currentEndNumber = nextSlot?.end ?? null;
  useEffect(() => {
    if (currentEndNumber === null) return;
    setEndHits((prev) => {
      const next = new Map<string, TargetHit>();
      for (const [key, hit] of prev) {
        if (key.startsWith(`${currentEndNumber}-`)) next.set(key, hit);
      }
      return next;
    });
  }, [currentEndNumber]);

  const currentEndHits = useMemo(() => Array.from(endHits.values()), [endHits]);

  function handleUndo() {
    setArrows((prev) => {
      if (prev.length === 0) return prev;
      const sorted = [...prev].sort(
        (a, b) =>
          a.endNumber - b.endNumber || a.arrowNumber - b.arrowNumber
      );
      sorted.pop();
      return sorted;
    });
    setEditingArrow(null);
  }

  function handleEditArrow(end: number, arrow: number) {
    setEditingArrow({ end, arrow });
  }

  function handleSave() {
    startTransition(async () => {
      await performSave(arrows, { manual: true });
    });
  }

  // Build matrix view (ends × arrows)
  const matrix = useMemo(() => {
    const m: Array<Array<Captured | null>> = [];
    for (let e = 1; e <= scoreSet.endsCount; e++) {
      const row: Array<Captured | null> = [];
      for (let a = 1; a <= scoreSet.arrowsPerEnd; a++) {
        row.push(
          arrows.find(
            (x) => x.endNumber === e && x.arrowNumber === a
          ) ?? null
        );
      }
      m.push(row);
    }
    return m;
  }, [arrows, scoreSet.arrowsPerEnd, scoreSet.endsCount]);

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky header with state */}
      <div className="sticky top-14 z-10 -mx-4 border-b bg-card/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{athleteName}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {scoreSet.distance}m · End{' '}
              <span className="font-medium text-foreground">
                {nextSlot?.end ?? scoreSet.endsCount}
              </span>
              /{scoreSet.endsCount} ·{' '}
              <span className="font-medium text-foreground">
                {arrows.length}
              </span>
              /{totalArrows} flechas
            </p>
            <div className="mt-1.5">
              <SyncStatusBadge
                status={syncStatus}
                pendingCount={
                  syncStatus === 'pending' || syncStatus === 'offline' || syncStatus === 'error'
                    ? arrows.length
                    : 0
                }
              />
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-bold tabular-nums leading-none tracking-tight">
              {totalScore}
            </p>
            <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground tabular-nums">
              <span>prom {average}</span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5">
                <span className="font-semibold text-foreground">{tenCount}</span>
                <span>10s</span>
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-400/15 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5">
                <span className="font-semibold">{xCount}</span>
                <span>X</span>
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-gradient-to-r from-primary to-[hsl(var(--primary-hover))] transition-all duration-500 ease-out"
            style={{ width: `${(arrows.length / totalArrows) * 100}%` }}
            aria-label={`Progreso ${Math.round((arrows.length / totalArrows) * 100)}%`}
          />
        </div>
      </div>

      {/* Ends matrix */}
      <div className="space-y-2">
        {matrix.map((row, eIdx) => {
          const endNumber = eIdx + 1;
          const endTotal = row.reduce(
            (acc, a) => acc + (a ? valueToScore(a.value) : 0),
            0
          );
          const isCurrentEnd = nextSlot?.end === endNumber;
          return (
            <div
              key={endNumber}
              className={cn(
                'rounded-xl border p-2 transition',
                isCurrentEnd && 'border-primary bg-primary/5'
              )}
            >
              <div className="mb-1 flex items-center justify-between px-1 text-xs text-muted-foreground">
                <span>End {endNumber}</span>
                <span className="tabular-nums">{endTotal}</span>
              </div>
              <div
                className="grid gap-1.5"
                style={{
                  gridTemplateColumns: `repeat(${scoreSet.arrowsPerEnd}, minmax(0, 1fr))`
                }}
              >
                {row.map((a, aIdx) => {
                  const arrowNumber = aIdx + 1;
                  const isNext =
                    nextSlot?.end === endNumber &&
                    nextSlot?.arrow === arrowNumber;
                  const isEditing =
                    editingArrow?.end === endNumber &&
                    editingArrow?.arrow === arrowNumber;
                  return (
                    <button
                      key={arrowNumber}
                      type="button"
                      onClick={() =>
                        a ? handleEditArrow(endNumber, arrowNumber) : undefined
                      }
                      className={cn(
                        'h-10 rounded-md text-sm font-bold tabular-nums transition-all duration-200',
                        'flex items-center justify-center',
                        a
                          ? 'bg-muted text-foreground shadow-sm animate-fade-in-scale'
                          : 'border border-dashed border-border/60 text-muted-foreground/40 font-medium',
                        isNext &&
                          'ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/5 border-primary animate-pulse-soft text-primary/70',
                        isEditing &&
                          'ring-2 ring-amber-500 ring-offset-2 ring-offset-background'
                      )}
                      aria-label={
                        a
                          ? `Editar flecha ${arrowNumber} del end ${endNumber}`
                          : `Flecha ${arrowNumber} pendiente`
                      }
                    >
                      {a ? String(a.value) : arrowNumber}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Score input — toggle between button grid and interactive target */}
      <div className="rounded-xl border bg-card p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground line-clamp-2">
            {nextSlot
              ? editingArrow
                ? `Editando end ${editingArrow.end} · flecha ${editingArrow.arrow}`
                : inputMode === 'target'
                  ? `Toca la diana · end ${nextSlot.end} · flecha ${nextSlot.arrow}`
                  : `Toca el puntaje · end ${nextSlot.end} · flecha ${nextSlot.arrow}`
              : 'Score set completo'}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            <div
              role="tablist"
              aria-label="Modo de captura"
              className="inline-flex overflow-hidden rounded-md border bg-background"
            >
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'target'}
                onClick={() => switchInputMode('target')}
                className={cn(
                  'flex h-9 items-center gap-1 px-2.5 text-xs font-medium transition',
                  inputMode === 'target'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
                title="Capturar tocando la diana"
              >
                <Crosshair className="h-3.5 w-3.5" />
                Diana
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'buttons'}
                onClick={() => switchInputMode('buttons')}
                className={cn(
                  'flex h-9 items-center gap-1 px-2.5 text-xs font-medium transition',
                  inputMode === 'buttons'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
                title="Capturar con botones de puntaje"
              >
                <Grid3x3 className="h-3.5 w-3.5" />
                Botones
              </button>
            </div>
            <button
              type="button"
              onClick={handleUndo}
              disabled={arrows.length === 0}
              className="flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition hover:bg-muted disabled:opacity-40"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Deshacer
            </button>
          </div>
        </div>

        {inputMode === 'target' ? (
          <InteractiveTarget
            hits={currentEndHits}
            onTap={handleTargetTap}
            disabled={!nextSlot}
          />
        ) : (
          <div className="grid grid-cols-6 gap-2">
            {SCORE_BUTTONS.map((b) => (
              <button
                key={String(b.value)}
                type="button"
                disabled={!nextSlot}
                onClick={() => handleScore(b.value)}
                className={cn(
                  'h-16 select-none rounded-xl text-xl font-bold transition-transform',
                  'active:scale-95 active:animate-press',
                  'disabled:cursor-not-allowed disabled:opacity-40',
                  TIER_STYLES[b.tier]
                )}
                aria-label={`Puntaje ${b.label}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Save bar */}
      <div className="sticky bottom-20 sm:bottom-4 z-20">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || arrows.length === 0}
          className={cn(
            'flex h-14 w-full items-center justify-center gap-2 rounded-xl',
            'text-base font-semibold shadow-card-hover',
            'transition active:scale-[0.99] disabled:opacity-60',
            arrows.length === totalArrows
              ? 'bg-gradient-to-r from-primary to-[hsl(var(--primary-hover))] text-primary-foreground ring-2 ring-primary/30'
              : 'bg-primary text-primary-foreground hover:bg-primary-hover'
          )}
        >
          {isPending ? (
            <>
              <Save className="h-5 w-5 animate-pulse" />
              Guardando…
            </>
          ) : arrows.length === totalArrows ? (
            <>
              <Check className="h-5 w-5" />
              Guardar score set completo
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              Guardar progreso ({arrows.length}/{totalArrows})
            </>
          )}
        </button>
      </div>
    </div>
  );
}
