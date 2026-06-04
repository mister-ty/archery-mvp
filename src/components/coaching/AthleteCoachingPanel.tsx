import { Sparkles } from 'lucide-react';
import { getAthleteCoachingTips } from '@/server/actions/coaching';
import { CoachingTipCard } from './CoachingTipCard';
import type { Audience } from '@/lib/coaching/types';

type Props = {
  athleteId: string;
  audience: Audience;
  /** Title displayed above the cards. Defaults vary per audience. */
  title?: string;
};

export async function AthleteCoachingPanel({ athleteId, audience, title }: Props) {
  const tips = await getAthleteCoachingTips(athleteId, audience);

  if (tips.length === 0) return null;

  const heading =
    title ??
    (audience === 'athlete' ? 'Recomendaciones' : 'Tips para este atleta');

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {heading}
        </h2>
      </div>
      <div className="space-y-2">
        {tips.map((tip) => (
          <CoachingTipCard key={tip.key} tip={tip} athleteId={athleteId} />
        ))}
      </div>
    </section>
  );
}
