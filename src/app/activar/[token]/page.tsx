import Link from 'next/link';
import { AlertTriangle, MailCheck } from 'lucide-react';
import { getInvitationByToken } from '@/server/actions/invitations';
import {
  INVITABLE_ROLE_LABELS,
  type InvitableRole
} from '@/lib/validation/invitation';
import { Logo } from '@/components/ui/logo';
import { AcceptForm } from './AcceptForm';

type Props = { params: { token: string } };

export const dynamic = 'force-dynamic';

export default async function ActivatePage({ params }: Props) {
  const invitation = await getInvitationByToken(params.token);

  return (
    <main className="grid min-h-dvh place-items-center bg-brand-gradient px-4 py-12">
      <div className="w-full max-w-sm space-y-6 animate-fade-in-scale">
        <div className="space-y-3 text-center">
          <Logo size="lg" showWordmark={false} className="mx-auto" />
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Activar cuenta
            </h1>
            <p className="text-sm text-muted-foreground">
              Bienvenido a Archery MVP
            </p>
          </div>
        </div>

        {!invitation ? (
          <div className="card-elevated p-6 space-y-3 border-destructive/50 bg-destructive/5">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-medium">Invitación inválida o expirada</p>
            </div>
            <p className="text-xs text-muted-foreground">
              El link no es válido o ya fue utilizado. Pide a tu administrador
              que genere uno nuevo.
            </p>
            <Link
              href="/login"
              className="btn-outline mt-2 h-10 w-full"
            >
              Ir al login
            </Link>
          </div>
        ) : (
          <div className="card-elevated p-6 space-y-4">
            <div className="rounded-lg bg-muted/60 p-3">
              <div className="flex items-start gap-2">
                <MailCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="text-xs">
                  <p>
                    Te están invitando como{' '}
                    <span className="font-semibold text-foreground">
                      {INVITABLE_ROLE_LABELS[invitation.role as InvitableRole] ??
                        invitation.role}
                    </span>{' '}
                    en{' '}
                    <span className="font-semibold text-foreground">
                      {invitation.clubName}
                    </span>
                    .
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Crea tu contraseña para empezar.
                  </p>
                </div>
              </div>
            </div>
            <AcceptForm
              token={params.token}
              email={invitation.email}
              role={invitation.role}
            />
          </div>
        )}
      </div>
    </main>
  );
}
