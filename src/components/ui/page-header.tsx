import { cn } from '@/lib/utils';

type Props = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
};

/**
 * Consistent page header. Use at the top of every route-level page to
 * avoid hand-rolling h1/p/action layouts.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className
}: Props) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 animate-fade-in-up',
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function SectionHeader({
  title,
  description,
  action,
  className
}: SectionHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="section-eyebrow">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
