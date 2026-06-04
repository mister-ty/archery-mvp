import Link from 'next/link';
import { ChevronRight, Sparkles } from 'lucide-react';
import { getClubCoachingTips } from '@/server/actions/coaching';
import { CoachingTipCard } from './CoachingTipCard';

const MAX_ROWS = 10;

export async function TeamCoachingBand() {
  const rows = await getClubCoachingTips();
  if (rows.length === 0) return null;

  const visible = rows.slice(0, MAX_ROWS);
  const hidden = rows.length - visible.length;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Atletas que requieren atención
          </h2>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {rows.length}
        </span>
      </div>
      <div className="space-y-2">
        {visible.map((row) => (
          <Link
            key={row.athleteId}
            href={`/deportistas/${row.athleteId}`}
            className="group block transition hover:-translate-y-0.5"
          >
            <div className="flex items-stretch gap-2">
              <div className="flex-1">
                <CoachingTipCard tip={row.topTip} compact />
              </div>
              <div className="flex w-8 shrink-0 items-center justify-center rounded-xl border bg-card text-muted-foreground transition group-hover:border-primary/40 group-hover:text-primary">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </div>
            </div>
          </Link>
        ))}
        {hidden > 0 && (
          <p className="text-center text-xs text-muted-foreground">
            +{hidden} atletas más con tips disponibles
          </p>
        )}
      </div>
    </section>
  );
}
