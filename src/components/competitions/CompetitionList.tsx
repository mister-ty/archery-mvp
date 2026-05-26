'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2, Trophy } from 'lucide-react';
import { deleteCompetition } from '@/server/actions/competitions';
import {
  COMPETITION_TYPE_LABELS,
  type CompetitionTypeCode
} from '@/lib/validation/competition';
import { EmptyState } from '@/components/ui/empty-state';

type CompetitionRow = {
  id: string;
  name: string;
  date: Date;
  type: string;
  location: string | null;
  totalScore: number;
  rank: number | null;
  xCount: number | null;
  notes: string | null;
};

type Props = {
  competitions: CompetitionRow[];
  canEdit: boolean;
};

function DeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (!window.confirm(`¿Borrar "${name}" del historial?`)) return;
    startTransition(async () => {
      const result = await deleteCompetition(id);
      if (result.ok) {
        toast.success('Competición borrada');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-card px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30 transition disabled:opacity-50"
      aria-label={`Borrar ${name}`}
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
}

export function CompetitionList({ competitions, canEdit }: Props) {
  if (competitions.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="Sin competiciones registradas"
        description="Los torneos que se registren aparecerán aquí ordenados por fecha."
      />
    );
  }

  return (
    <ul className="divide-y rounded-xl border bg-card shadow-card overflow-hidden">
      {competitions.map((c) => (
        <li
          key={c.id}
          className="flex items-start justify-between gap-3 p-3 transition hover:bg-muted/30"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-hidden />
              <p className="truncate text-sm font-medium">{c.name}</p>
              {c.rank !== null && (
                <span className="ml-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold tabular-nums">
                  #{c.rank}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(c.date).toLocaleDateString('es-CO', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}{' '}
              · {COMPETITION_TYPE_LABELS[c.type as CompetitionTypeCode] ?? c.type}
              {c.location && ` · ${c.location}`}
            </p>
            {c.notes && (
              <p className="mt-1 text-xs text-muted-foreground italic line-clamp-2">
                {c.notes}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums leading-none">
                {c.totalScore}
              </p>
              {c.xCount !== null && (
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  X {c.xCount}
                </p>
              )}
            </div>
            {canEdit && <DeleteButton id={c.id} name={c.name} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
