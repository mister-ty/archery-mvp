'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createTrainingSession } from '@/server/actions/sessions';

type AthleteOpt = {
  id: string;
  firstName: string;
  lastName: string;
};

const STANDARD_DISTANCES = [18, 30, 50, 60, 70, 90];

export default function SessionForm({ athletes }: { athletes: AthleteOpt[] }) {
  const router = useRouter();
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([]);
  const [selectedDistances, setSelectedDistances] = useState<number[]>([18]);
  const [isPending, startTransition] = useTransition();

  function toggleAthlete(id: string) {
    setSelectedAthletes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleDistance(d: number) {
    setSelectedDistances((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    if (selectedAthletes.length === 0) {
      toast.error('Selecciona al menos un deportista');
      return;
    }
    if (selectedDistances.length === 0) {
      toast.error('Selecciona al menos una distancia');
      return;
    }

    const indoor = fd.get('indoor') === 'on';

    startTransition(async () => {
      const res = await createTrainingSession({
        athleteIds: selectedAthletes,
        date: new Date(),
        type: String(fd.get('type') ?? 'TECHNICAL') as
          | 'TECHNICAL'
          | 'SERIES'
          | 'COMPETITION_SIM'
          | 'WARMUP',
        indoor,
        weather: indoor
          ? null
          : ((String(fd.get('weather') ?? 'CALM') as 'CALM' | 'MODERATE' | 'STRONG')),
        weatherNotes: null,
        distances: selectedDistances
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success('Sesión creada');
      // Redirect to scoring of first session (single athlete case = direct)
      router.push(`/sesion/${res.data.sessionIds[0]}/puntuacion`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 animate-fade-in">
      <section>
        <h2 className="mb-2 text-sm font-semibold">Deportistas</h2>
        {athletes.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No hay deportistas activos. Crea uno primero.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {athletes.map((a) => {
              const checked = selectedAthletes.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAthlete(a.id)}
                  className={`flex h-12 items-center justify-between rounded-lg border px-3 text-sm transition active:scale-[0.99] ${
                    checked
                      ? 'border-primary bg-primary/10'
                      : 'hover:bg-muted'
                  }`}
                >
                  <span>
                    {a.firstName} {a.lastName}
                  </span>
                  {checked && (
                    <span className="text-xs font-semibold text-primary">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Tipo de sesión</h2>
        <select name="type" defaultValue="TECHNICAL" className="input">
          <option value="TECHNICAL">Técnica</option>
          <option value="SERIES">Series</option>
          <option value="COMPETITION_SIM">Simulacro de competencia</option>
          <option value="WARMUP">Calentamiento</option>
        </select>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Distancias (metros)</h2>
        <div className="grid grid-cols-6 gap-2">
          {STANDARD_DISTANCES.map((d) => {
            const on = selectedDistances.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDistance(d)}
                className={`h-12 rounded-lg border text-sm font-semibold transition active:scale-95 ${
                  on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="indoor" className="h-4 w-4" />
          Sesión indoor
        </label>
        <div>
          <h2 className="mb-1 text-sm font-semibold">Viento</h2>
          <select name="weather" defaultValue="CALM" className="input">
            <option value="CALM">Calmo</option>
            <option value="MODERATE">Moderado</option>
            <option value="STRONG">Fuerte</option>
          </select>
        </div>
      </section>

      <button
        type="submit"
        disabled={isPending}
        className="h-14 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-lg transition active:scale-[0.99] disabled:opacity-60"
      >
        {isPending ? 'Creando…' : 'Crear sesión'}
      </button>

      <style>{`
        .input {
          height: 3rem;
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          padding: 0 0.75rem;
        }
        .input:focus { outline: none; box-shadow: 0 0 0 2px hsl(var(--ring)); }
      `}</style>
    </form>
  );
}
