'use client';

import { useScrollProgress } from '@/lib/hooks/use-scroll-progress';
import {
  arrowAtProgress,
  BULLSEYE,
  IMPACT_THRESHOLD
} from '@/lib/animation/arrow-trajectory';

/**
 * Scroll-driven background: a translucent arrow follows a bezier curve
 * upward to a target in the top-right corner. Lives behind all content
 * with `pointer-events: none` and `aria-hidden`. Subtle by design — the
 * KPIs and charts stay the focus.
 */
export function ArrowJourneyBackground() {
  const progress = useScrollProgress();
  const { x, y, angle } = arrowAtProgress(progress);
  const landed = progress >= IMPACT_THRESHOLD;

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        style={{ willChange: 'transform' }}
      >
        {/* Trail: a faint dotted Bezier path the arrow follows. Static —
            the arrow itself carries the motion. */}
        <path
          d={`M -10 95 Q 30 40 ${BULLSEYE.x} ${BULLSEYE.y}`}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="0.4"
          strokeDasharray="1 2.5"
          strokeLinecap="round"
          className="opacity-[0.18] dark:opacity-[0.28]"
        />

        {/* Target rings at the bullseye corner. Lower opacity overall in
            light mode, slightly higher in dark for visibility. */}
        <g
          transform={`translate(${BULLSEYE.x} ${BULLSEYE.y})`}
          className="opacity-[0.22] dark:opacity-[0.34]"
        >
          <circle r="12" fill="hsl(var(--muted))" />
          <circle r="9.5" fill="hsl(var(--foreground) / 0.15)" />
          <circle r="7" fill="hsl(221 83% 53% / 0.35)" />
          <circle r="4.5" fill="hsl(0 70% 55% / 0.45)" />
          <circle r="2" fill="hsl(45 95% 55% / 0.6)" />
        </g>

        {/* Arrow group — positioned + rotated by scroll progress. The
            transition softens the final lock-on when scroll values jitter. */}
        <g
          style={{
            transform: `translate(${x}px, ${y}px) rotate(${angle}deg)`,
            transformBox: 'fill-box',
            transformOrigin: '0 0',
            transition: landed
              ? 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
              : 'none',
            willChange: 'transform'
          }}
        >
          {/* Shaft */}
          <line
            x1="-11"
            y1="0"
            x2="-1"
            y2="0"
            stroke="hsl(var(--primary))"
            strokeWidth="0.55"
            strokeLinecap="round"
            className="opacity-60 dark:opacity-70"
          />
          {/* Tip */}
          <polygon
            points="0,0 -2,-1.1 -2,1.1"
            fill="hsl(var(--primary))"
            className="opacity-70 dark:opacity-85"
          />
          {/* Fletching */}
          <polygon
            points="-11,0 -13,-1.4 -11.7,-0.2"
            fill="hsl(var(--primary))"
            className="opacity-50 dark:opacity-65"
          />
          <polygon
            points="-11,0 -13,1.4 -11.7,0.2"
            fill="hsl(var(--primary))"
            className="opacity-50 dark:opacity-65"
          />
        </g>
      </svg>
    </div>
  );
}
