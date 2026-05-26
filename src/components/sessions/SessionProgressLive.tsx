'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, CheckCircle2 } from 'lucide-react';
import { getSessionProgressSnapshot } from '@/server/actions/sessions';

interface Snapshot {
  arrows: number;
  total: number;
  lastUpdatedAt: string | null;
  completedAt: string | null;
}

interface Props {
  sessionId: string;
  initial: Snapshot;
}

const POLL_INTERVAL_MS = 7000;

function relativeTime(iso: string | null): string {
  if (!iso) return 'sin capturas todavía';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 5000) return 'hace instantes';
  if (diff < 60_000) return `hace ${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`;
  return `hace ${Math.floor(diff / 3_600_000)} h`;
}

export function SessionProgressLive({ sessionId, initial }: Props) {
  const [snap, setSnap] = useState<Snapshot>(initial);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, forceTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (document.visibilityState !== 'visible') return;
      const res = await getSessionProgressSnapshot(sessionId);
      if (cancelled) return;
      if (res.ok) setSnap(res.data);
    }

    function start() {
      if (timerRef.current) return;
      timerRef.current = setInterval(tick, POLL_INTERVAL_MS);
    }
    function stop() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        tick();
        start();
      } else {
        stop();
      }
    }

    start();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [sessionId]);

  // Re-render every 10s so "hace Xs" stays fresh even between polls.
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  const isComplete = !!snap.completedAt;
  const pct = snap.total > 0 ? Math.round((snap.arrows / snap.total) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          {isComplete ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>Sesión completada</span>
            </>
          ) : (
            <>
              <Activity className="h-4 w-4 animate-pulse text-primary" />
              <span>En progreso</span>
            </>
          )}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {snap.arrows} / {snap.total} flechas · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-gradient-to-r from-primary/70 to-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Última flecha: {relativeTime(snap.lastUpdatedAt)}
      </p>
    </div>
  );
}
