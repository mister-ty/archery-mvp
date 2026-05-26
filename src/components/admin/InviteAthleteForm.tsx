'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { inviteAthleteUser } from '@/server/actions/athletes';

interface Props {
  athleteId: string;
  defaultEmail?: string;
}

export function InviteAthleteForm({ athleteId, defaultEmail = '' }: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [isPending, startTransition] = useTransition();
  const [lastLink, setLastLink] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await inviteAthleteUser(athleteId, trimmed);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLastLink(res.data.link);
      toast.success(
        res.data.emailProvider === 'resend'
          ? 'Invitación enviada por email'
          : res.data.emailProvider === 'console'
            ? 'Invitación creada (revisa logs del servidor)'
            : 'Invitación creada (email falló, copia el link)'
      );
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@ejemplo.com"
          className="h-10 flex-1 rounded-lg border bg-background px-3 text-sm focus:border-primary focus:outline-none focus:shadow-glow"
          required
          disabled={isPending}
        />
        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary-hover disabled:opacity-50"
        >
          {isPending ? 'Enviando…' : 'Invitar'}
        </button>
      </div>
      {lastLink && (
        <p className="break-all rounded-lg bg-muted/50 p-2 text-[11px] text-muted-foreground">
          <span className="font-semibold">Link:</span> {lastLink}
        </p>
      )}
    </form>
  );
}
