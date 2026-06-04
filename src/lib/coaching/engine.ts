/**
 * Composite of the coaching rule set.
 *
 * The engine is the only consumer of `rules.ts` + `templates.ts`. It
 * provides three guarantees so the rest of the codebase can rely on
 * its output without knowing how the rules feel:
 *
 *  1. Determinism — given the same context + audience, the output is
 *     identical. No Date.now() except via the context.
 *  2. Audience filtering — a rule that has nothing to say to an
 *     audience (template title is empty) never reaches the UI.
 *  3. Family dedup — at most one tip per family ('acwr', 'evolution',
 *     etc.) per call. Rule order in `ALL_RULES` decides the winner.
 *
 * Hydration happens here so rules stay pure data → drafts.
 */

import { ALL_RULES, ruleFamily } from './rules';
import { TIP_TEMPLATES } from './templates';
import type {
  AthleteCoachingContext,
  EngineOptions,
  Tip,
  TipDraft
} from './types';

const SEVERITY_RANK: Record<Tip['severity'], number> = {
  warn: 0,
  suggest: 1,
  info: 2
};

/**
 * Runs every rule, sorts drafts by severity, drops nulls / mute
 * templates / family duplicates, hydrates with audience-specific copy.
 */
export function runCoachingEngine(
  ctx: AthleteCoachingContext,
  opts: EngineOptions
): Tip[] {
  const drafts: TipDraft[] = [];
  for (const rule of ALL_RULES) {
    const draft = rule(ctx);
    if (!draft) continue;
    if (opts.onlyKeys && !opts.onlyKeys.includes(draft.key)) continue;
    drafts.push(draft);
  }

  // Sort: severity primary (warn > suggest > info), then drafts that
  // link to a chart first, then by rule order via the original index.
  const indexed = drafts.map((d, idx) => ({ d, idx }));
  indexed.sort((a, b) => {
    const sev = SEVERITY_RANK[a.d.severity] - SEVERITY_RANK[b.d.severity];
    if (sev !== 0) return sev;
    const am = a.d.metric ? 0 : 1;
    const bm = b.d.metric ? 0 : 1;
    if (am !== bm) return am - bm;
    return a.idx - b.idx;
  });

  const tips: Tip[] = [];
  const seenFamilies = new Set<string>();

  for (const { d } of indexed) {
    const tpl = TIP_TEMPLATES[d.key]?.[opts.audience];
    if (!tpl) continue;
    const { title, detail } = tpl(d.data ?? {});
    if (!title) continue; // Audience opted out of this rule.
    const family = ruleFamily(d.key);
    if (seenFamilies.has(family)) continue;
    seenFamilies.add(family);
    tips.push({
      ...d,
      audience: opts.audience,
      title,
      detail
    });
  }

  const cap = opts.topN === undefined ? 3 : opts.topN;
  if (cap === null) return tips;
  return tips.slice(0, cap);
}
