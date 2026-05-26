'use client';

import { useEffect, useState } from 'react';

/**
 * Returns the document scroll progress as a number in [0, 1].
 *
 * - Throttled with `requestAnimationFrame` — one update per frame max.
 * - Returns 0 on the server / first render to avoid SSR hydration drift.
 * - Honours `prefers-reduced-motion: reduce` — the value freezes at 1
 *   (final state, arrow embedded in bullseye) so users with reduced
 *   motion see the static composition instead of a scroll-driven trail.
 * - Pauses while the tab is hidden.
 */
export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      setProgress(1);
      return;
    }

    let frame: number | null = null;
    const compute = () => {
      frame = null;
      if (document.hidden) return;
      const max = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        1
      );
      const raw = window.scrollY / max;
      const clamped = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      setProgress(clamped);
    };

    const schedule = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(compute);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', schedule);

    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, []);

  return progress;
}
