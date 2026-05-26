import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

type Props = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  /** Compact = single-line, used inside small cards. */
  compact?: boolean;
};

/**
 * Reusable empty state. Use instead of bare `<p>Sin datos</p>` so the
 * experience feels intentional everywhere it appears.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false
}: Props) {
  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border border-dashed bg-card/40 p-4',
          className
        )}
      >
        {Icon && (
          <Icon
            className="h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card/40 px-6 py-10 text-center animate-fade-in-scale',
        className
      )}
    >
      {Icon && (
        <div
          className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground ring-1 ring-border"
          aria-hidden
        >
          <Icon className="h-6 w-6" />
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description && (
          <p className="max-w-sm text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
