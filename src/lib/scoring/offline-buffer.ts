import type { ArrowValue } from '@/lib/validation/score';

/**
 * Offline buffer for F4 score capture.
 *
 * Persists in-progress score-set state to localStorage so a network loss
 * (or accidental refresh) doesn't lose the coach's last few arrows.
 *
 * Design:
 *  - One bucket per (sessionId, distance).
 *  - `dirty: true` means local changes are NOT yet on the server.
 *  - `savedAt` is the epoch ms of the last successful server save (or null).
 *  - `version` lets us safely discard buffers if we change the shape later.
 *
 * All functions are pure (no React), localStorage-safe (no throw if
 * unavailable or quota-exceeded), and easily testable under jsdom.
 */

const STORAGE_PREFIX = 'archery:scoreSet:v1:';
const SCHEMA_VERSION = 1 as const;

export type BufferedArrow = {
  endNumber: number;
  arrowNumber: number;
  value: ArrowValue;
};

export type ScoreBuffer = {
  version: typeof SCHEMA_VERSION;
  sessionId: string;
  distance: number;
  arrows: BufferedArrow[];
  dirty: boolean;
  savedAt: number | null;
  updatedAt: number;
};

export function bufferKey(sessionId: string, distance: number): string {
  return `${STORAGE_PREFIX}${sessionId}:${distance}`;
}

function safeGetStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    // Touch storage to detect disabled/private-mode browsers.
    const probe = '__archery_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadBuffer(
  sessionId: string,
  distance: number
): ScoreBuffer | null {
  const storage = safeGetStorage();
  if (!storage) return null;

  const raw = storage.getItem(bufferKey(sessionId, distance));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as ScoreBuffer;
    if (
      !parsed ||
      parsed.version !== SCHEMA_VERSION ||
      parsed.sessionId !== sessionId ||
      parsed.distance !== distance ||
      !Array.isArray(parsed.arrows)
    ) {
      // Schema drift or tampering — discard.
      storage.removeItem(bufferKey(sessionId, distance));
      return null;
    }
    return parsed;
  } catch {
    storage.removeItem(bufferKey(sessionId, distance));
    return null;
  }
}

export function saveBuffer(
  buffer: Omit<ScoreBuffer, 'version' | 'updatedAt'>
): ScoreBuffer | null {
  const storage = safeGetStorage();
  if (!storage) return null;

  const full: ScoreBuffer = {
    ...buffer,
    version: SCHEMA_VERSION,
    updatedAt: Date.now()
  };
  try {
    storage.setItem(bufferKey(buffer.sessionId, buffer.distance), JSON.stringify(full));
    return full;
  } catch {
    // Quota exceeded or write blocked — give up silently; in-memory state
    // remains the source of truth for this session.
    return null;
  }
}

export function clearBuffer(sessionId: string, distance: number): void {
  const storage = safeGetStorage();
  if (!storage) return;
  try {
    storage.removeItem(bufferKey(sessionId, distance));
  } catch {
    // best-effort
  }
}

/**
 * Convenience: mark buffer as synced (dirty=false, savedAt=now) without
 * deleting it. Keeps the local snapshot available in case the user
 * navigates away and back.
 */
export function markBufferSynced(
  sessionId: string,
  distance: number,
  arrows: BufferedArrow[]
): ScoreBuffer | null {
  return saveBuffer({
    sessionId,
    distance,
    arrows,
    dirty: false,
    savedAt: Date.now()
  });
}
