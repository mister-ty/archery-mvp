'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createCompetition } from '@/server/actions/competitions';
import {
  COMPETITION_TYPES,
  COMPETITION_TYPE_LABELS,
  type CompetitionTypeCode
} from '@/lib/validation/competition';

type Props = {
  athleteId: string;
  onDone?: () => void;
};

const INPUT =
  'mt-1 h-10 w-full rounded-lg border bg-background px-3 outline-none transition focus:ring-2 focus:ring-ring text-sm';

function todayISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function CompetitionForm({ athleteId, onDone }: Props) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayISO());
  const [type, setType] = useState<CompetitionTypeCode>('INDOOR_18M');
  const [location, setLocation] = useState('');
  const [totalScore, setTotalScore] = useState('');
  const [rank, setRank] = useState('');
  const [xCount, setXCount] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, startTransition] = useTransition();

  const canSubmit =
    name.trim().length > 0 && date && totalScore.length > 0 && !pending;

  const reset = () => {
    setName('');
    setDate(todayISO());
    setType('INDOOR_18M');
    setLocation('');
    setTotalScore('');
    setRank('');
    setXCount('');
    setNotes('');
    setErrors({});
  };

  const handleSubmit = () => {
    setErrors({});
    const parsedScore = Number(totalScore);
    if (Number.isNaN(parsedScore)) {
      setErrors({ totalScore: ['Debe ser un número'] });
      return;
    }
    startTransition(async () => {
      const result = await createCompetition({
        athleteId,
        name: name.trim(),
        date: new Date(date),
        type,
        location: location.trim() || null,
        totalScore: parsedScore,
        rank: rank ? Number(rank) : null,
        xCount: xCount ? Number(xCount) : null,
        notes: notes.trim() || null
      });
      if (result.ok) {
        toast.success('Competición registrada');
        reset();
        router.refresh();
        onDone?.();
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  };

  const fieldError = (k: string) =>
    errors[k]?.[0] ? (
      <p className="mt-1 text-xs text-red-600">{errors[k][0]}</p>
    ) : null;

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="comp-name" className="text-xs font-medium">
          Nombre del torneo
        </label>
        <input
          id="comp-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
          placeholder="Departamental Antioquia 2026"
          className={INPUT}
          maxLength={120}
        />
        {fieldError('name')}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="comp-date" className="text-xs font-medium">
            Fecha
          </label>
          <input
            id="comp-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={pending}
            className={INPUT}
          />
          {fieldError('date')}
        </div>
        <div>
          <label htmlFor="comp-type" className="text-xs font-medium">
            Modalidad
          </label>
          <select
            id="comp-type"
            value={type}
            onChange={(e) => setType(e.target.value as CompetitionTypeCode)}
            disabled={pending}
            className={INPUT}
          >
            {COMPETITION_TYPES.map((t) => (
              <option key={t} value={t}>
                {COMPETITION_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="comp-location" className="text-xs font-medium">
          Sede (opcional)
        </label>
        <input
          id="comp-location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          disabled={pending}
          className={INPUT}
          maxLength={120}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="comp-score" className="text-xs font-medium">
            Score total
          </label>
          <input
            id="comp-score"
            type="number"
            inputMode="numeric"
            value={totalScore}
            onChange={(e) => setTotalScore(e.target.value)}
            disabled={pending}
            className={INPUT}
            min={0}
            max={2000}
            required
          />
          {fieldError('totalScore')}
        </div>
        <div>
          <label htmlFor="comp-rank" className="text-xs font-medium">
            Posición
          </label>
          <input
            id="comp-rank"
            type="number"
            inputMode="numeric"
            value={rank}
            onChange={(e) => setRank(e.target.value)}
            disabled={pending}
            className={INPUT}
            min={1}
            placeholder="—"
          />
          {fieldError('rank')}
        </div>
        <div>
          <label htmlFor="comp-xs" className="text-xs font-medium">
            Xs
          </label>
          <input
            id="comp-xs"
            type="number"
            inputMode="numeric"
            value={xCount}
            onChange={(e) => setXCount(e.target.value)}
            disabled={pending}
            className={INPUT}
            min={0}
            placeholder="—"
          />
          {fieldError('xCount')}
        </div>
      </div>

      <div>
        <label htmlFor="comp-notes" className="text-xs font-medium">
          Notas (opcional)
        </label>
        <textarea
          id="comp-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={pending}
          maxLength={1000}
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition disabled:opacity-50"
      >
        {pending ? 'Guardando…' : 'Registrar competición'}
      </button>
    </div>
  );
}
