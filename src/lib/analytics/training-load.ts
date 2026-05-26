/**
 * Training load analytics.
 *
 * Two complementary views:
 *  - **Weekly volume**: how many arrows / sessions per ISO week (Monday-
 *    based) for the last N weeks. Intuitive bar chart material.
 *  - **ACWR** (Acute:Chronic Workload Ratio): widely-used sports-science
 *    metric. Acute = arrows in the last 7 days; chronic = average of
 *    arrows in the last 28 days reduced to a weekly equivalent;
 *    ratio = acute / chronic. Buckets follow the literature:
 *      < 0.8  → "low"      (undertrained / recovery)
 *      0.8–1.3 → "optimal" ("sweet spot")
 *      1.3–1.5 → "caution"
 *      > 1.5  → "overload" (injury / burnout risk)
 *
 * All functions are pure. Dates are treated in UTC for week bucketing
 * to avoid DST/locale surprises across tests and runtimes.
 */

export type SessionPoint = {
  date: Date;
  arrowsCount: number;
};

export type WeeklyAgg = {
  weekStart: Date; // Monday 00:00 UTC of that ISO week
  arrows: number;
  sessions: number;
};

export type AcwrZone = 'inactive' | 'low' | 'optimal' | 'caution' | 'overload';

export type Acwr = {
  acuteArrows: number; // last 7 days
  chronicArrowsPerWeek: number | null; // average per week over last 28 days
  ratio: number | null;
  zone: AcwrZone;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns the Monday-00:00:00.000-UTC marking the start of the ISO week
 * that contains `d`. UTC is deliberate — week aggregation is locale-
 * insensitive and timezone-agnostic.
 */
export function startOfIsoWeekUTC(d: Date): Date {
  const day = d.getUTCDay(); // 0 (Sun) .. 6 (Sat)
  const diff = day === 0 ? -6 : 1 - day; // Monday-based
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff)
  );
  return monday;
}

export function addDaysUTC(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS);
}

/**
 * Weekly aggregates ordered chronologically (oldest first), one entry
 * per week within the window `[asOf - weeks*7d, asOf]`. Weeks with no
 * sessions are present with arrows=0 and sessions=0 — important so the
 * bar chart shows the gaps, not just the active weeks.
 */
export function weeklyAggregates(
  sessions: SessionPoint[],
  weeks = 12,
  asOf: Date = new Date()
): WeeklyAgg[] {
  if (weeks < 1) return [];

  const lastWeekStart = startOfIsoWeekUTC(asOf);
  const firstWeekStart = addDaysUTC(lastWeekStart, -(weeks - 1) * 7);

  // Build the empty timeline first, then fold sessions into it.
  const buckets: WeeklyAgg[] = [];
  for (let i = 0; i < weeks; i++) {
    buckets.push({
      weekStart: addDaysUTC(firstWeekStart, i * 7),
      arrows: 0,
      sessions: 0
    });
  }

  for (const s of sessions) {
    if (s.date < firstWeekStart) continue;
    if (s.date > addDaysUTC(lastWeekStart, 7)) continue;
    const sessionWeekStart = startOfIsoWeekUTC(s.date);
    const offsetWeeks = Math.round(
      (sessionWeekStart.getTime() - firstWeekStart.getTime()) / (7 * DAY_MS)
    );
    if (offsetWeeks < 0 || offsetWeeks >= weeks) continue;
    buckets[offsetWeeks].arrows += s.arrowsCount;
    buckets[offsetWeeks].sessions += 1;
  }

  return buckets;
}

function classifyAcwr(ratio: number | null, hasAcute: boolean): AcwrZone {
  if (ratio === null) return hasAcute ? 'low' : 'inactive';
  if (ratio < 0.8) return 'low';
  if (ratio <= 1.3) return 'optimal';
  if (ratio <= 1.5) return 'caution';
  return 'overload';
}

/**
 * Compute Acute:Chronic Workload Ratio as of `asOf` (default now).
 *
 * Conventions:
 *  - acute window  = last 7 days
 *  - chronic window = last 28 days
 *  - chronicArrowsPerWeek = chronic_total / 4
 *  - ratio = acute / chronicArrowsPerWeek when chronic > 0
 *  - When chronic = 0 the ratio is undefined (no baseline). We
 *    classify the athlete as "inactive" if acute is also 0, else
 *    "low" (chronic is 0 but acute > 0 — recently restarted).
 */
export function acwr(
  sessions: SessionPoint[],
  asOf: Date = new Date()
): Acwr {
  const acuteCutoff = new Date(asOf.getTime() - 7 * DAY_MS);
  const chronicCutoff = new Date(asOf.getTime() - 28 * DAY_MS);

  let acuteArrows = 0;
  let chronicArrows = 0;
  for (const s of sessions) {
    if (s.date > asOf) continue;
    // Half-open windows (cutoff, asOf]. "Last 7 days" excludes the
    // session that happened exactly 7 days ago at the same time.
    if (s.date > chronicCutoff) chronicArrows += s.arrowsCount;
    if (s.date > acuteCutoff) acuteArrows += s.arrowsCount;
  }

  const chronicArrowsPerWeek = chronicArrows > 0 ? chronicArrows / 4 : null;
  const ratio =
    chronicArrowsPerWeek !== null && chronicArrowsPerWeek > 0
      ? acuteArrows / chronicArrowsPerWeek
      : null;

  return {
    acuteArrows,
    chronicArrowsPerWeek:
      chronicArrowsPerWeek !== null
        ? Number(chronicArrowsPerWeek.toFixed(1))
        : null,
    ratio: ratio !== null ? Number(ratio.toFixed(2)) : null,
    zone: classifyAcwr(ratio, acuteArrows > 0)
  };
}

/**
 * Days since the most recent session in the list (using calendar days,
 * UTC). Returns null if no sessions exist.
 */
export function daysSinceLastSession(
  sessions: SessionPoint[],
  asOf: Date = new Date()
): number | null {
  if (sessions.length === 0) return null;
  let latest = sessions[0].date;
  for (const s of sessions) if (s.date > latest) latest = s.date;
  const deltaMs = asOf.getTime() - latest.getTime();
  if (deltaMs < 0) return 0;
  return Math.floor(deltaMs / DAY_MS);
}
