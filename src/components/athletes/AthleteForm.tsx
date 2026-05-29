'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createAthlete } from '@/server/actions/athletes';

type Option = { id: string; name: string };

type Props = {
  modalities: Option[];
  categories: Option[];
  coaches: Array<{ id: string; firstName: string; lastName: string; clubId: string }>;
  clubs: Option[];
  defaultClubId: string;
};

export default function AthleteForm({
  modalities,
  categories,
  coaches,
  clubs,
  defaultClubId
}: Props) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const input = {
      firstName: String(fd.get('firstName') ?? ''),
      lastName: String(fd.get('lastName') ?? ''),
      documentId: String(fd.get('documentId') ?? ''),
      birthDate: new Date(String(fd.get('birthDate') ?? '')),
      dominantHand: String(fd.get('dominantHand') ?? 'RIGHT') as 'RIGHT' | 'LEFT',
      bowModalityId: String(fd.get('bowModalityId') ?? ''),
      categoryId: String(fd.get('categoryId') ?? ''),
      clubId: String(fd.get('clubId') ?? defaultClubId),
      coachId: (String(fd.get('coachId') ?? '') || null) as string | null,
      inviteEmail: String(fd.get('inviteEmail') ?? '').trim()
    };

    startTransition(async () => {
      const res = await createAthlete(input);
      if (!res.ok) {
        toast.error(res.error);
        if (res.fieldErrors) setErrors(res.fieldErrors as Record<string, string[]>);
        return;
      }
      const invitedTo = res.data.invitationEmail;
      if (invitedTo) {
        toast.success(`Deportista creado e invitado a ${invitedTo}`);
      } else {
        toast.success('Deportista creado');
      }
      router.push('/deportistas');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 animate-fade-in">
      <Field label="Nombre" error={errors.firstName?.[0]}>
        <input name="firstName" required className="input" />
      </Field>
      <Field label="Apellido" error={errors.lastName?.[0]}>
        <input name="lastName" required className="input" />
      </Field>
      <Field label="Documento" error={errors.documentId?.[0]}>
        <input name="documentId" required className="input" />
      </Field>
      <Field label="Fecha de nacimiento" error={errors.birthDate?.[0]}>
        <input name="birthDate" type="date" required className="input" />
      </Field>
      <Field label="Mano dominante">
        <select name="dominantHand" defaultValue="RIGHT" className="input">
          <option value="RIGHT">Diestro</option>
          <option value="LEFT">Zurdo</option>
        </select>
      </Field>
      <Field label="Modalidad de arco" error={errors.bowModalityId?.[0]}>
        <select name="bowModalityId" required defaultValue="" className="input">
          <option value="" disabled>Selecciona…</option>
          {modalities.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Categoría" error={errors.categoryId?.[0]}>
        <select name="categoryId" required defaultValue="" className="input">
          <option value="" disabled>Selecciona…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Club" error={errors.clubId?.[0]}>
        <select
          name="clubId"
          required
          defaultValue={defaultClubId}
          className="input"
        >
          {!defaultClubId && (
            <option value="" disabled>Selecciona un club…</option>
          )}
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Coach (opcional)">
        <select name="coachId" defaultValue="" className="input">
          <option value="">— Sin asignar —</option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>
              {c.firstName} {c.lastName}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Email para invitar (opcional)"
        error={errors.inviteEmail?.[0]}
      >
        <input
          name="inviteEmail"
          type="email"
          placeholder="atleta@email.com"
          className="input"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Si lo llenas, se envía una invitación para que el atleta active su
          cuenta y pueda capturar sus propios puntajes.
        </p>
      </Field>

      <button
        type="submit"
        disabled={isPending}
        className="h-12 w-full rounded-lg bg-primary font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
      >
        {isPending ? 'Guardando…' : 'Crear deportista'}
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

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
