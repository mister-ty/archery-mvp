'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { createAthleteSelfSession } from '@/server/actions/sessions';

const TYPE_OPTIONS = [
  { value: 'SERIES', label: 'Series' },
  { value: 'TECHNICAL', label: 'Técnica' },
  { value: 'COMPETITION_SIM', label: 'Sim. Competición' },
  { value: 'WARMUP', label: 'Calentamiento' }
] as const;

export function AthleteSelfSessionForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState<(typeof TYPE_OPTIONS)[number]['value']>('SERIES');
  const [indoor, setIndoor] = useState(false);
  const [distance, setDistance] = useState(18);
  const [endsCount, setEndsCount] = useState(6);
  const [arrowsPerEnd, setArrowsPerEnd] = useState(3);

  const total = endsCount * arrowsPerEnd;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await createAthleteSelfSession({
        mode: 'custom',
        type,
        indoor,
        scoreSets: [{ distance, endsCount, arrowsPerEnd }]
      });
      if (!result.ok) {
        toast.error(result.error ?? 'No se pudo crear la sesión');
        return;
      }
      router.push(`/sesion/${result.data.sessionId}/puntuacion`);
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Tipo</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="input h-11 w-full"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-3 rounded-lg border bg-background px-3 h-11">
          <input
            type="checkbox"
            checked={indoor}
            onChange={(e) => setIndoor(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">Indoor</span>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Distancia (m)</span>
          <input
            type="number"
            inputMode="numeric"
            min={5}
            max={90}
            value={distance}
            onChange={(e) => setDistance(Number(e.target.value))}
            className="input h-11 w-full tabular-nums"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Ends</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={20}
            value={endsCount}
            onChange={(e) => setEndsCount(Number(e.target.value))}
            className="input h-11 w-full tabular-nums"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Flechas / end</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={12}
            value={arrowsPerEnd}
            onChange={(e) => setArrowsPerEnd(Number(e.target.value))}
            className="input h-11 w-full tabular-nums"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm">
        <span className="text-muted-foreground">Total de flechas</span>
        <span className="font-semibold tabular-nums">{total}</span>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn-primary h-11 w-full"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          'Empezar y capturar'
        )}
      </button>
    </form>
  );
}
