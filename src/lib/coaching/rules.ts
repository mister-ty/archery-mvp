/**
 * The 15 coaching rules. Each rule is a pure function that reads the
 * athlete context and returns a TipDraft (= rule fires) or null (= does
 * not apply). The engine combines, dedupes and hydrates them.
 *
 * Thresholds are inline so the rule reads as documentation: anyone
 * skimming the file sees what fires when. Adjust them based on real
 * usage feedback; bumping a number does not break any other layer.
 *
 * Note: rules that only make sense for one audience still return a
 * TipDraft — `engine.ts` filters by audience using the template lookup
 * (templates whose title === '' for an audience are treated as N/A).
 */

import type { AthleteCoachingContext, Rule, TipDraft } from './types';

// Minimum sample size before we trust ratio-based comparisons. Below
// this, σ and avg moves are likely noise.
const MIN_ARROWS_FOR_TRENDS = 30;

export const noDataCold: Rule = (ctx) => {
  if (ctx.arrowsLast30 > 0) return null;
  return {
    key: 'noData.cold',
    severity: 'warn',
    data: { athleteName: ctx.athleteName }
  };
};

export const acwrOverload: Rule = (ctx) => {
  if (ctx.acwrZone !== 'overload') return null;
  return {
    key: 'acwr.overload',
    severity: 'warn',
    metric: 'acwr',
    data: { athleteName: ctx.athleteName, ratio: ctx.acwrRatio }
  };
};

export const acwrCaution: Rule = (ctx) => {
  if (ctx.acwrZone !== 'caution') return null;
  return {
    key: 'acwr.caution',
    severity: 'suggest',
    metric: 'acwr',
    data: { athleteName: ctx.athleteName, ratio: ctx.acwrRatio }
  };
};

export const acwrInactive: Rule = (ctx) => {
  if (ctx.daysSinceLastSession === null) return null;
  if (ctx.daysSinceLastSession <= 14) return null;
  return {
    key: 'acwr.inactive',
    severity: 'warn',
    metric: 'acwr',
    data: {
      athleteName: ctx.athleteName,
      daysSince: ctx.daysSinceLastSession
    }
  };
};

export const acwrLowReturn: Rule = (ctx) => {
  if (ctx.daysSinceLastSession === null) return null;
  if (ctx.daysSinceLastSession < 7 || ctx.daysSinceLastSession > 14) return null;
  if (ctx.acwrZone !== 'low') return null;
  return {
    key: 'acwr.lowReturn',
    severity: 'suggest',
    metric: 'acwr',
    data: {
      athleteName: ctx.athleteName,
      daysSince: ctx.daysSinceLastSession
    }
  };
};

export const evolutionDropVsPrev30: Rule = (ctx) => {
  if (ctx.avgLast30 === null || ctx.avgPrev30 === null) return null;
  if (ctx.arrowsLast30 < MIN_ARROWS_FOR_TRENDS) return null;
  const delta = ctx.avgLast30 - ctx.avgPrev30;
  if (delta >= -1.0) return null;
  return {
    key: 'evolution.dropVsPrev30',
    severity: 'suggest',
    metric: 'evolution',
    data: {
      athleteName: ctx.athleteName,
      avgLast30: ctx.avgLast30,
      avgPrev30: ctx.avgPrev30,
      delta
    }
  };
};

export const evolutionImprovedVsPrev30: Rule = (ctx) => {
  if (ctx.avgLast30 === null || ctx.avgPrev30 === null) return null;
  if (ctx.arrowsLast30 < MIN_ARROWS_FOR_TRENDS) return null;
  const delta = ctx.avgLast30 - ctx.avgPrev30;
  if (delta <= 0.5) return null;
  return {
    key: 'evolution.improvedVsPrev30',
    severity: 'info',
    metric: 'evolution',
    data: {
      athleteName: ctx.athleteName,
      avgLast30: ctx.avgLast30,
      avgPrev30: ctx.avgPrev30,
      delta
    }
  };
};

export const evolutionBestRound: Rule = (ctx) => {
  if (!ctx.lastSession?.isNewBestRound) return null;
  return {
    key: 'evolution.bestRound',
    severity: 'info',
    metric: 'evolution',
    data: {
      athleteName: ctx.athleteName,
      bestRound: ctx.bestRoundLast30
    }
  };
};

export const consistencyImproving: Rule = (ctx) => {
  if (ctx.stddevLast30 === null || ctx.stddevPrev30 === null) return null;
  if (ctx.arrowsLast30 < MIN_ARROWS_FOR_TRENDS) return null;
  // σ lower = more consistent. Trigger if it dropped by ≥15%.
  if (ctx.stddevLast30 > ctx.stddevPrev30 * 0.85) return null;
  return {
    key: 'consistency.improving',
    severity: 'info',
    metric: 'consistency',
    data: {
      athleteName: ctx.athleteName,
      stddevLast30: ctx.stddevLast30,
      stddevPrev30: ctx.stddevPrev30
    }
  };
};

export const consistencyWorsening: Rule = (ctx) => {
  if (ctx.stddevLast30 === null || ctx.stddevPrev30 === null) return null;
  if (ctx.arrowsLast30 < MIN_ARROWS_FOR_TRENDS) return null;
  // Higher σ = worse. Trigger if it went up ≥20%.
  if (ctx.stddevLast30 < ctx.stddevPrev30 * 1.2) return null;
  return {
    key: 'consistency.worsening',
    severity: 'suggest',
    metric: 'consistency',
    data: {
      athleteName: ctx.athleteName,
      stddevLast30: ctx.stddevLast30,
      stddevPrev30: ctx.stddevPrev30
    }
  };
};

export const attendanceLow: Rule = (ctx) => {
  if (ctx.attendancePct === null) return null;
  if (ctx.attendancePct >= 70) return null;
  return {
    key: 'attendance.low',
    severity: 'suggest',
    metric: 'attendance',
    data: { athleteName: ctx.athleteName, attendancePct: ctx.attendancePct }
  };
};

export const coachObsStale: Rule = (ctx) => {
  // Either no observations ever, or last one was > 30 days ago.
  if (ctx.lastObservationAt === null) {
    // Only trigger if the athlete has actually been active — otherwise
    // `noData.cold` already covers them.
    if (ctx.arrowsLast30 === 0) return null;
    return {
      key: 'coachObs.stale',
      severity: 'suggest',
      metric: 'observations',
      data: { athleteName: ctx.athleteName, daysSinceLast: null }
    };
  }
  const days = Math.floor(
    (Date.now() - ctx.lastObservationAt.getTime()) / (24 * 60 * 60 * 1000)
  );
  if (days <= 30) return null;
  return {
    key: 'coachObs.stale',
    severity: 'suggest',
    metric: 'observations',
    data: { athleteName: ctx.athleteName, daysSinceLast: days }
  };
};

export const sessionAboveAvg: Rule = (ctx) => {
  if (!ctx.lastSession || ctx.lastSession.avgScore === null) return null;
  if (ctx.avgLast30 === null) return null;
  const delta = ctx.lastSession.avgScore - ctx.avgLast30;
  if (delta <= 0.5) return null;
  return {
    key: 'session.aboveAvg',
    severity: 'info',
    metric: 'evolution',
    data: {
      athleteName: ctx.athleteName,
      sessionAvg: ctx.lastSession.avgScore,
      delta
    }
  };
};

export const sessionBelowAvg: Rule = (ctx) => {
  if (!ctx.lastSession || ctx.lastSession.avgScore === null) return null;
  if (ctx.avgLast30 === null) return null;
  const delta = ctx.lastSession.avgScore - ctx.avgLast30;
  if (delta >= -1.0) return null;
  return {
    key: 'session.belowAvg',
    severity: 'suggest',
    metric: 'evolution',
    data: {
      athleteName: ctx.athleteName,
      sessionAvg: ctx.lastSession.avgScore,
      delta
    }
  };
};

export const volumeDropoffWeek: Rule = (ctx) => {
  // Need a non-trivial previous week to compare against.
  if (ctx.arrowsPrevWeek < 30) return null;
  if (ctx.arrowsThisWeek >= ctx.arrowsPrevWeek * 0.5) return null;
  return {
    key: 'volume.dropoffWeek',
    severity: 'suggest',
    metric: 'acwr',
    data: {
      athleteName: ctx.athleteName,
      arrowsThisWeek: ctx.arrowsThisWeek,
      arrowsPrevWeek: ctx.arrowsPrevWeek
    }
  };
};

/**
 * Order matters: rules earlier in the list win ties when the engine
 * dedupes by family (e.g. `acwr.overload` beats `acwr.caution`).
 */
export const ALL_RULES: Rule[] = [
  noDataCold,
  acwrInactive,
  acwrOverload,
  acwrCaution,
  acwrLowReturn,
  evolutionDropVsPrev30,
  consistencyWorsening,
  volumeDropoffWeek,
  attendanceLow,
  coachObsStale,
  evolutionImprovedVsPrev30,
  consistencyImproving,
  evolutionBestRound,
  sessionAboveAvg,
  sessionBelowAvg
];

/** Maps RuleKey to a "family" so the engine can collapse near-duplicates. */
export function ruleFamily(key: TipDraft['key']): string {
  return key.split('.')[0];
}
