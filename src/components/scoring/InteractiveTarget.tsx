'use client';

import { useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { ArrowValue } from '@/lib/validation/score';
import {
  projectTap,
  scoreFromTap,
  type Point
} from '@/lib/scoring/target-scoring';

export type TargetHit = { x: number; y: number; value: ArrowValue };

type Props = {
  /** Hits to render on top of the target (typically arrows of the current end). */
  hits: TargetHit[];
  /** Fired when the user taps inside the target area. */
  onTap: (hit: TargetHit) => void;
  /** Disable input — e.g. when the score set is fully captured. */
  disabled?: boolean;
  /** Optional label for accessibility (defaults to "Diana de tiro con arco"). */
  ariaLabel?: string;
};

const RINGS: Array<{ r: number; fill: string; stroke: string }> = [
  // Outermost first so SVG draws bullseye on top.
  { r: 100, fill: '#ffffff', stroke: '#1f2937' },
  { r: 90, fill: '#ffffff', stroke: '#1f2937' },
  { r: 80, fill: '#1f2937', stroke: '#1f2937' },
  { r: 70, fill: '#1f2937', stroke: '#f3f4f6' },
  { r: 60, fill: '#2563eb', stroke: '#f3f4f6' },
  { r: 50, fill: '#2563eb', stroke: '#f3f4f6' },
  { r: 40, fill: '#dc2626', stroke: '#f3f4f6' },
  { r: 30, fill: '#dc2626', stroke: '#f3f4f6' },
  { r: 20, fill: '#facc15', stroke: '#1f2937' },
  { r: 10, fill: '#facc15', stroke: '#1f2937' }
];

export function InteractiveTarget({
  hits,
  onTap,
  disabled,
  ariaLabel = 'Diana de tiro con arco'
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleEvent = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const point: Point = projectTap(
        clientX - rect.left,
        clientY - rect.top,
        { width: rect.width, height: rect.height }
      );
      const value = scoreFromTap(point);
      // Light haptic for parity with the button grid.
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.(15);
      }
      onTap({ x: point.x, y: point.y, value });
    },
    [disabled, onTap]
  );

  return (
    <div className="flex w-full justify-center">
      <svg
        ref={svgRef}
        viewBox="-110 -110 220 220"
        className={cn(
          'h-auto w-full max-w-[360px] touch-none select-none rounded-2xl bg-card shadow-card',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-crosshair'
        )}
        role="button"
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        onPointerDown={(e) => {
          // Capture the pointer so we get the tap even if the user drifts.
          (e.target as Element).setPointerCapture?.(e.pointerId);
          handleEvent(e.clientX, e.clientY);
        }}
      >
        {/* Rings */}
        {RINGS.map((r) => (
          <circle
            key={r.r}
            cx={0}
            cy={0}
            r={r.r}
            fill={r.fill}
            stroke={r.stroke}
            strokeWidth={0.8}
          />
        ))}
        {/* X marker — a small inner circle inside the 10 ring */}
        <circle
          cx={0}
          cy={0}
          r={5}
          fill="none"
          stroke="#1f2937"
          strokeWidth={0.8}
        />

        {/* Vertical and horizontal hairlines for aiming reference */}
        <line
          x1={-100}
          y1={0}
          x2={100}
          y2={0}
          stroke="#1f2937"
          strokeOpacity={0.25}
          strokeWidth={0.4}
        />
        <line
          x1={0}
          y1={-100}
          x2={0}
          y2={100}
          stroke="#1f2937"
          strokeOpacity={0.25}
          strokeWidth={0.4}
        />

        {/* Hit markers */}
        {hits.map((h, i) => (
          <g key={`${i}-${h.x}-${h.y}`}>
            <circle
              cx={h.x}
              cy={h.y}
              r={3.5}
              fill="#ffffff"
              stroke="#0f172a"
              strokeWidth={1.2}
            />
            <circle cx={h.x} cy={h.y} r={1.4} fill="#0f172a" />
          </g>
        ))}
      </svg>
    </div>
  );
}
