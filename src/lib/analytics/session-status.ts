/**
 * Helpers for the athlete dashboard "Mis sesiones" card.
 *
 * Pure: no Prisma, no DOM. Tested in session-status.test.ts.
 */

export type SessionCaptureStatus = 'pending' | 'partial' | 'complete';

/**
 * Derive how complete an athlete's capture for a training session is,
 * based on expected vs actually-saved arrow counts.
 *
 *  - 0 captured        → 'pending'
 *  - some, but < total → 'partial'
 *  - ≥ total           → 'complete'  (defensive ≥ to cover any
 *                        re-edits that overshoot the expected count)
 */
export function computeSessionCaptureStatus(
  expected: number,
  captured: number
): SessionCaptureStatus {
  if (captured <= 0) return 'pending';
  if (captured >= expected) return 'complete';
  return 'partial';
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Spanish relative date label for the athlete's local timezone. Returns
 * `null` when the date is outside the ±2-day window the upcoming-
 * sessions card cares about, so the caller can fall back to an absolute
 * date format.
 */
export function formatRelativeDate(
  date: Date,
  now: Date = new Date()
): string | null {
  const day = startOfLocalDay(date).getTime();
  const today = startOfLocalDay(now).getTime();
  const diffDays = Math.round((day - today) / DAY_MS);
  switch (diffDays) {
    case -2:
      return 'Anteayer';
    case -1:
      return 'Ayer';
    case 0:
      return 'Hoy';
    case 1:
      return 'Mañana';
    case 2:
      return 'Pasado mañana';
    default:
      return null;
  }
}
