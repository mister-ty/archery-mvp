'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { getSessionCoachingTips } from '@/server/actions/coaching';
import type { Tip } from '@/lib/coaching/types';
import { CoachingTipCard } from './CoachingTipCard';

type Props = {
  sessionId: string;
  /**
   * Set to true by the parent (ScoreCapture) the moment the last arrow
   * is saved and the session is marked complete. Closing the modal
   * does not unset this — it's a one-shot signal.
   */
  triggered: boolean;
  athleteId?: string;
};

/**
 * Inline post-session feedback. Renders as a non-blocking card with a
 * dismiss button rather than a fullscreen modal so the athlete can keep
 * seeing their captured arrows underneath while reading.
 */
export function SessionCloseTipsModal({ sessionId, triggered, athleteId }: Props) {
  const [tips, setTips] = useState<Tip[] | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!triggered || tips !== null || dismissed) return;
    let cancelled = false;
    (async () => {
      const res = await getSessionCoachingTips(sessionId);
      if (cancelled) return;
      setTips(res);
    })();
    return () => {
      cancelled = true;
    };
  }, [triggered, sessionId, tips, dismissed]);

  if (!triggered || dismissed) return null;
  if (tips === null) {
    return (
      <div className="rounded-xl border bg-card p-3 text-xs text-muted-foreground animate-fade-in-up">
        Analizando tu sesión…
      </div>
    );
  }
  if (tips.length === 0) {
    // Nothing meaningful to say. Keep quiet — silence beats noise here.
    return null;
  }

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-card animate-fade-in-up">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <h3 className="text-sm font-semibold">Tu sesión en resumen</h3>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted"
          aria-label="Cerrar tips"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-2">
        {tips.map((tip) => (
          <CoachingTipCard key={tip.key} tip={tip} athleteId={athleteId} compact />
        ))}
      </div>
    </div>
  );
}
