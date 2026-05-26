import { cn } from '@/lib/utils';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
};

const SIZE = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-11 w-11'
} as const;

const ICON_SIZE = { sm: 14, md: 18, lg: 22 } as const;

/**
 * Brand mark — a stylized concentric target.
 * Inline SVG so it renders correctly in PDF/email rasters and inherits
 * `currentColor` for theming.
 */
export function Logo({ size = 'md', showWordmark = true, className }: Props) {
  const px = ICON_SIZE[size];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 select-none',
        className
      )}
      aria-label="Archery MVP"
    >
      <span
        className={cn(
          'grid place-items-center rounded-xl bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shadow-sm ring-1 ring-primary/20',
          SIZE[size]
        )}
        aria-hidden
      >
        <svg
          width={px}
          height={px}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx={12} cy={12} r={10} />
          <circle cx={12} cy={12} r={6} />
          <circle cx={12} cy={12} r={2} fill="currentColor" />
        </svg>
      </span>
      {showWordmark && (
        <span className="font-semibold tracking-tight">Archery</span>
      )}
    </span>
  );
}
