'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { createInvitation } from '@/server/actions/invitations';
import {
  INVITABLE_ROLES,
  INVITABLE_ROLE_LABELS,
  type InvitableRole
} from '@/lib/validation/invitation';
import type { Role } from '@prisma/client';

type ClubOption = { id: string; name: string };

type Props = {
  callerRole: Role;
  callerClubId: string | null;
  clubs: ClubOption[];
};

const INPUT_CLASS =
  'mt-1 h-10 w-full rounded-lg border bg-background px-3 outline-none transition focus:ring-2 focus:ring-ring text-sm';

export function InviteForm({ callerRole, callerClubId, clubs }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>(
    callerRole === 'COACH' ? 'ATHLETE' : 'COACH'
  );
  const [clubId, setClubId] = useState(
    callerRole === 'SUPER_ADMIN' ? clubs[0]?.id ?? '' : callerClubId ?? ''
  );
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // COACH can only invite ATHLETE
  const allowedRoles =
    callerRole === 'COACH'
      ? (['ATHLETE'] as const)
      : callerRole === 'CLUB_ADMIN'
        ? (['COACH', 'ATHLETE'] as const)
        : INVITABLE_ROLES;

  const handleSubmit = (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    if (!email.trim() || !clubId) return;

    startTransition(async () => {
      try {
        const result = await createInvitation({
          email: email.trim().toLowerCase(),
          role,
          clubId
        });
        if (result.ok) {
          const { emailProvider } = result.data;
          if (emailProvider === 'resend') {
            toast.success('Invitación enviada por email');
          } else if (emailProvider === 'failed') {
            toast.warning('Invitación creada — el envío de email falló, comparte el link manualmente');
          } else {
            toast.success('Invitación creada — comparte el link');
          }
          setLastLink(result.data.link);
          setEmail('');
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } catch (err) {
        // Surface unexpected action errors instead of silently failing.
        console.error('[InviteForm] action threw', err);
        toast.error('Error inesperado al crear la invitación');
      }
    });
  };

  const copyLink = async () => {
    if (!lastLink) return;
    try {
      await navigator.clipboard.writeText(lastLink);
      toast.success('Link copiado');
    } catch {
      toast.error('No se pudo copiar — selecciona y copia manualmente');
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <label htmlFor="invite-email" className="text-xs font-medium">
            Email del invitado
          </label>
          <input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending}
            placeholder="usuario@ejemplo.com"
            className={INPUT_CLASS}
            autoComplete="off"
          />
        </div>

        <div>
          <label htmlFor="invite-role" className="text-xs font-medium">
            Rol
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as InvitableRole)}
            disabled={pending || allowedRoles.length === 1}
            className={INPUT_CLASS}
          >
            {allowedRoles.map((r) => (
              <option key={r} value={r}>
                {INVITABLE_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        {callerRole === 'SUPER_ADMIN' && clubs.length > 1 && (
          <div>
            <label htmlFor="invite-club" className="text-xs font-medium">
              Club
            </label>
            <select
              id="invite-club"
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
              disabled={pending}
              className={INPUT_CLASS}
            >
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || !email.trim() || !clubId}
          className="h-10 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition disabled:opacity-50"
        >
          {pending ? 'Creando…' : 'Crear invitación'}
        </button>
      </div>

      {lastLink && (
        <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Link de activación (válido 7 días)
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={lastLink}
              onClick={(e) => e.currentTarget.select()}
              className="flex-1 rounded-md border bg-background px-2 py-1 text-xs font-mono"
            />
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs hover:bg-muted/50 transition"
              aria-label="Copiar link"
            >
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Compártelo por el canal que prefieras. El envío automático por
            email se habilita en Fase 2.
          </p>
        </div>
      )}
    </div>
  );
}
