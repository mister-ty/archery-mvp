import { cn } from '@/lib/utils';

/**
 * Shimmering skeleton block. Use inside loading.tsx files (Next.js
 * loading UI) to convey perceived performance.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-md bg-muted',
        // Built-in shimmer using a moving gradient mask.
        "relative overflow-hidden after:absolute after:inset-0 after:-translate-x-full after:bg-[linear-gradient(90deg,transparent,hsl(var(--background)/0.6),transparent)] after:animate-[shimmer_1.4s_infinite]",
        className
      )}
      {...props}
    />
  );
}
