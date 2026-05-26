'use client';

import { Check, Cloud, CloudOff, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SyncStatus = 'synced' | 'pending' | 'saving' | 'error' | 'offline';

type Props = {
  status: SyncStatus;
  pendingCount?: number;
  className?: string;
};

const STYLES: Record<SyncStatus, string> = {
  synced: 'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400',
  pending: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400',
  saving: 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400',
  error: 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400',
  offline: 'border-zinc-300 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
};

export function SyncStatusBadge({ status, pendingCount = 0, className }: Props) {
  const label = (() => {
    switch (status) {
      case 'synced':
        return 'Sincronizado';
      case 'pending':
        return pendingCount > 0 ? `Sin sincronizar (${pendingCount})` : 'Cambios sin guardar';
      case 'saving':
        return 'Guardando…';
      case 'error':
        return 'Error — reintentando';
      case 'offline':
        return pendingCount > 0
          ? `Sin conexión · ${pendingCount} en local`
          : 'Sin conexión';
    }
  })();

  const Icon = (() => {
    switch (status) {
      case 'synced':
        return Check;
      case 'pending':
        return Cloud;
      case 'saving':
        return Loader2;
      case 'error':
        return AlertTriangle;
      case 'offline':
        return CloudOff;
    }
  })();

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums',
        STYLES[status],
        className
      )}
      role="status"
      aria-live="polite"
    >
      <Icon
        className={cn('h-3 w-3', status === 'saving' && 'animate-spin')}
        aria-hidden
      />
      {label}
    </span>
  );
}
