'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { completeCoachProfile } from '@/server/actions/invitations';

const INPUT_CLASS =
  'mt-1 h-11 w-full rounded-lg border bg-background px-3.5 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:shadow-glow disabled:opacity-60';

export function CoachOnboardingForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    startTransition(async () => {
      const result = await completeCoachProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim()
      });
      if (result.ok) {
        toast.success('Perfil completado');
        router.push('/equipo');
        router.refresh();
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="firstName" className="text-xs font-medium">
          Nombre
        </label>
        <input
          id="firstName"
          type="text"
          required
          autoComplete="given-name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          disabled={pending}
          className={INPUT_CLASS}
        />
        {fieldError('firstName')}
      </div>

      <div>
        <label htmlFor="lastName" className="text-xs font-medium">
          Apellido
        </label>
        <input
          id="lastName"
          type="text"
          required
          autoComplete="family-name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          disabled={pending}
          className={INPUT_CLASS}
        />
        {fieldError('lastName')}
      </div>

      <button
        type="submit"
        disabled={pending || !firstName.trim() || !lastName.trim()}
        className="btn-primary h-11 w-full"
      >
        {pending ? 'Guardando…' : 'Completar perfil'}
      </button>
    </form>
  );
}
