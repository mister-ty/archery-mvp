'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { acceptInvitation } from '@/server/actions/invitations';
import type { Role } from '@prisma/client';

type Props = {
  token: string;
  email: string;
  role: Role;
};

const INPUT_CLASS =
  'mt-1 h-11 w-full rounded-lg border bg-background px-3.5 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:shadow-glow disabled:opacity-60';

export function AcceptForm({ token, email, role }: Props) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const needsName = role === 'COACH';
  const canSubmit =
    password.length >= 8 &&
    password === passwordConfirm &&
    (!needsName || (firstName.trim() && lastName.trim()));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    startTransition(async () => {
      const result = await acceptInvitation({
        token,
        password,
        passwordConfirm,
        firstName: needsName ? firstName.trim() : undefined,
        lastName: needsName ? lastName.trim() : undefined
      });
      if (result.ok) {
        toast.success('Cuenta activada — ya puedes iniciar sesión');
        router.push('/login');
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
        <label className="text-xs font-medium text-muted-foreground">
          Email
        </label>
        <p className="mt-1 text-sm font-medium">{email}</p>
      </div>

      {needsName && (
        <>
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
        </>
      )}

      <div>
        <label htmlFor="password" className="text-xs font-medium">
          Contraseña (mín 8 caracteres)
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
          className={INPUT_CLASS}
        />
        {fieldError('password')}
      </div>

      <div>
        <label htmlFor="passwordConfirm" className="text-xs font-medium">
          Confirmar contraseña
        </label>
        <input
          id="passwordConfirm"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          disabled={pending}
          className={INPUT_CLASS}
        />
        {fieldError('passwordConfirm')}
        {passwordConfirm && password !== passwordConfirm && (
          <p className="mt-1 text-xs text-red-600">
            Las contraseñas no coinciden
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending || !canSubmit}
        className="btn-primary h-11 w-full"
      >
        {pending ? 'Activando…' : 'Activar cuenta'}
      </button>
    </form>
  );
}
