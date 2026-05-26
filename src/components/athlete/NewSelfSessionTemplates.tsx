'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ATHLETE_SESSION_TEMPLATES,
  totalArrows,
  type AthleteTemplateKey
} from '@/lib/scoring/athlete-self-templates';
import { createAthleteSelfSession } from '@/server/actions/sessions';

export function NewSelfSessionTemplates() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const start = (templateKey: AthleteTemplateKey) => {
    startTransition(async () => {
      const result = await createAthleteSelfSession({
        mode: 'template',
        templateKey
      });
      if (!result.ok) {
        toast.error(result.error ?? 'No se pudo crear la sesión');
        return;
      }
      router.push(`/sesion/${result.data.sessionId}/puntuacion`);
    });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ATHLETE_SESSION_TEMPLATES.map((t) => {
        const total = totalArrows(t);
        const first = t.scoreSets[0];
        return (
          <button
            key={t.key}
            type="button"
            disabled={pending}
            onClick={() => start(t.key)}
            className={cn(
              'group relative flex flex-col items-start gap-2 rounded-2xl border bg-card p-5 text-left shadow-card transition',
              'hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-card-hover',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0'
            )}
          >
            <div className="flex w-full items-center justify-between">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Target className="h-5 w-5" aria-hidden />
              </span>
              <span className="rounded-full border bg-background px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                {total} flechas
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight">{t.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.blurb}</p>
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>{t.indoor ? 'Indoor' : 'Outdoor'}</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">
                {first.endsCount} ends × {first.arrowsPerEnd} flechas
              </span>
            </div>
            {pending && (
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-card/70 backdrop-blur-sm">
                <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
