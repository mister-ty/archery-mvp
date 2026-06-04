/**
 * Public types for the coaching engine (Fase 6.0).
 *
 * The engine is a deterministic, LLM-free rule system. Each rule takes
 * an `AthleteCoachingContext` and either returns a `TipDraft` (the rule
 * fired) or `null` (the rule does not apply). The engine combines the
 * drafts of every rule, sorts, deduplicates, and hydrates titles/details
 * from `templates.ts` according to the requested `Audience`.
 *
 * No Prisma imports here so client components can read these types
 * without crossing the server boundary.
 */

import type { AcwrZone } from '@/lib/analytics/training-load';

export type Severity = 'info' | 'suggest' | 'warn';
export type Audience = 'athlete' | 'coach';
export type Metric = 'acwr' | 'consistency' | 'evolution' | 'attendance' | 'observations';

/**
 * Stable identifier for each rule. Used as React key, telemetry name,
 * dedup family and template lookup. Format: `<area>.<specific>`.
 */
export type RuleKey =
  | 'noData.cold'
  | 'acwr.overload'
  | 'acwr.caution'
  | 'acwr.inactive'
  | 'acwr.lowReturn'
  | 'evolution.dropVsPrev30'
  | 'evolution.improvedVsPrev30'
  | 'evolution.bestRound'
  | 'consistency.improving'
  | 'consistency.worsening'
  | 'attendance.low'
  | 'coachObs.stale'
  | 'session.aboveAvg'
  | 'session.belowAvg'
  | 'volume.dropoffWeek';

/**
 * What every rule produces. `engine.ts` hydrates title/detail by looking
 * up `templates[ruleKey][audience]` and calling it with the context.
 */
export type TipDraft = {
  key: RuleKey;
  severity: Severity;
  metric?: Metric;
  /**
   * Values the template will interpolate. Each rule decides what goes
   * in here — keeping the rules → templates seam pure JSON-ish data.
   */
  data?: Record<string, number | string | null>;
};

export type Tip = TipDraft & {
  audience: Audience;
  title: string;
  detail: string;
};

/**
 * Snapshot of one athlete's state that the rules read from. Built by
 * server actions from the existing analytics — no rule queries Prisma.
 */
export type AthleteCoachingContext = {
  athleteId: string;
  athleteName: string;
  // Volume / activity
  arrowsLast30: number;
  arrowsPrev30: number;
  sessionsLast30: number;
  daysSinceLastSession: number | null;
  // Scoring (per-arrow averages over 30-day windows)
  avgLast30: number | null;
  avgPrev30: number | null;
  bestRoundLast30: number | null;
  // Consistency
  stddevLast30: number | null;
  stddevPrev30: number | null;
  // Training load (ACWR)
  acwrZone: AcwrZone;
  acwrRatio: number | null;
  // Engagement
  attendancePct: number | null;
  lastObservationAt: Date | null;
  // Weekly volume — last two completed weeks
  arrowsThisWeek: number;
  arrowsPrevWeek: number;
  // Optional: just-finished session (only set when called from session close)
  lastSession?: {
    sessionId: string;
    avgScore: number | null;
    arrowsCount: number;
    isNewBestRound: boolean;
  };
};

export type SessionTipContext = AthleteCoachingContext & {
  lastSession: NonNullable<AthleteCoachingContext['lastSession']>;
};

/**
 * Engine configuration. `topN: null` means "no limit" (used by the
 * dedicated athlete profile view).
 */
export type EngineOptions = {
  audience: Audience;
  topN?: number | null;
  /**
   * Restrict to a specific subset of rules — used by the session-close
   * modal which only wants `session.*` + `evolution.bestRound`.
   */
  onlyKeys?: RuleKey[];
};

/** A single rule signature. Pure: no IO, no Date.now() except via context. */
export type Rule = (ctx: AthleteCoachingContext) => TipDraft | null;
