import { cn } from '@/lib/utils';

type Props = {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZE = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base'
} as const;

/**
 * Derive a stable foreground/background tint from a name string so
 * teammates look distinguishable in lists. Uses HSL hue rotation.
 */
function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

export function Avatar({ name, size = 'md', className }: Props) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const hue = hashHue(name);
  const bg = `hsl(${hue} 65% 92%)`;
  const fg = `hsl(${hue} 55% 30%)`;
  const ring = `hsl(${hue} 55% 70%)`;

  return (
    <span
      className={cn(
        'inline-grid place-items-center rounded-full font-semibold ring-1 ring-inset',
        SIZE[size],
        className
      )}
      style={{
        backgroundColor: bg,
        color: fg,
        // @ts-expect-error CSS custom prop for ring color
        '--tw-ring-color': ring
      }}
      aria-label={name}
    >
      {initials || '?'}
    </span>
  );
}
