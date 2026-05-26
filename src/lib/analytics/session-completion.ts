export const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface ScoreSetCompletionInput {
  endsCount: number;
  arrowsPerEnd: number;
  arrowCount: number;
}

export function isSessionComplete(scoreSets: ScoreSetCompletionInput[]): boolean {
  if (scoreSets.length === 0) return false;
  return scoreSets.every(
    (set) => set.arrowCount >= set.endsCount * set.arrowsPerEnd
  );
}

export function isWithinEditWindow(
  completedAt: Date | null,
  now: Date = new Date()
): boolean {
  if (!completedAt) return false;
  return now.getTime() - completedAt.getTime() <= EDIT_WINDOW_MS;
}

export function canStaffEditPostCompletion(
  completedAt: Date | null,
  now: Date = new Date()
): boolean {
  return completedAt !== null && isWithinEditWindow(completedAt, now);
}

export function canAthleteEdit(
  completedAt: Date | null,
  now: Date = new Date()
): boolean {
  if (completedAt === null) return true;
  return isWithinEditWindow(completedAt, now);
}

export function editableUntil(completedAt: Date | null): Date | null {
  if (!completedAt) return null;
  return new Date(completedAt.getTime() + EDIT_WINDOW_MS);
}
