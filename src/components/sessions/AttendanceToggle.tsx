'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { updateAttendance } from '@/server/actions/attendance';
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_STATUSES,
  type AttendanceStatus
} from '@/lib/validation/attendance';

type Props = {
  sessionId: string;
  initialStatus: AttendanceStatus | null;
  initialReason: string | null;
  athleteLabel?: string;
  compact?: boolean;
};

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  PRESENT:
    'bg-green-600 text-white border-green-600 dark:bg-green-700 dark:border-green-700',
  ABSENT:
    'bg-red-600 text-white border-red-600 dark:bg-red-700 dark:border-red-700',
  JUSTIFIED:
    'bg-blue-600 text-white border-blue-600 dark:bg-blue-700 dark:border-blue-700',
  LATE:
    'bg-yellow-500 text-white border-yellow-500 dark:bg-yellow-600 dark:border-yellow-600'
};

export function AttendanceToggle({
  sessionId,
  initialStatus,
  initialReason,
  athleteLabel,
  compact = false
}: Props) {
  const [status, setStatus] = useState<AttendanceStatus | null>(initialStatus);
  const [reason, setReason] = useState(initialReason ?? '');
  const [pending, startTransition] = useTransition();

  const commit = (nextStatus: AttendanceStatus, nextReason: string) => {
    startTransition(async () => {
      const result = await updateAttendance({
        sessionId,
        status: nextStatus,
        reason: nextStatus === 'PRESENT' ? null : nextReason || null
      });
      if (result.ok) {
        toast.success(
          athleteLabel
            ? `${athleteLabel}: ${ATTENDANCE_LABELS[nextStatus]}`
            : `Asistencia: ${ATTENDANCE_LABELS[nextStatus]}`
        );
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleStatusClick = (s: AttendanceStatus) => {
    setStatus(s);
    if (s === 'PRESENT') setReason('');
    commit(s, s === 'PRESENT' ? '' : reason);
  };

  const handleReasonBlur = () => {
    if (!status || status === 'PRESENT') return;
    if (reason === (initialReason ?? '')) return;
    commit(status, reason);
  };

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Estado de asistencia">
        {ATTENDANCE_STATUSES.map((s) => {
          const active = status === s;
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={pending}
              onClick={() => handleStatusClick(s)}
              className={`rounded-full px-3 py-1 text-xs border transition disabled:opacity-50 ${
                active
                  ? STATUS_COLORS[s]
                  : 'bg-transparent text-muted-foreground border-border hover:border-primary'
              }`}
            >
              {ATTENDANCE_LABELS[s]}
            </button>
          );
        })}
        {status === null && (
          <span className="text-xs text-muted-foreground self-center ml-1">
            Sin registrar
          </span>
        )}
      </div>

      {status && status !== 'PRESENT' && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={handleReasonBlur}
          rows={compact ? 1 : 2}
          placeholder="Motivo (opcional, máx 500)"
          maxLength={500}
          disabled={pending}
          className="w-full rounded-lg border bg-background px-3 py-1.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
        />
      )}
    </div>
  );
}
