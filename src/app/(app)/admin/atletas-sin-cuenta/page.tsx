import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { UserPlus, Mail, Clock } from 'lucide-react';
import { auth } from '@/lib/auth';
import { listAthletesWithoutAccount } from '@/server/actions/athletes';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';
import { InviteAthleteForm } from '@/components/admin/InviteAthleteForm';

export default async function AthletesWithoutAccountPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (
    session.user.role !== Role.SUPER_ADMIN &&
    session.user.role !== Role.CLUB_ADMIN
  ) {
    redirect('/');
  }

  const athletes = await listAthletesWithoutAccount();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Atletas sin cuenta"
        description="Estos deportistas existen como ficha pero no tienen acceso al sistema. Invítalos por email para que puedan capturar sus propias sesiones."
      />

      {athletes.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title="Todo en orden"
          description="Todos los deportistas activos tienen una cuenta vinculada."
        />
      ) : (
        <div className="space-y-3">
          {athletes.map((a) => {
            const fullName = `${a.firstName} ${a.lastName}`;
            return (
              <div
                key={a.id}
                className="rounded-2xl border bg-card p-4 shadow-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={fullName} size="md" />
                    <div>
                      <p className="font-semibold">{fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        Cédula {a.documentId} · {a.club.name}
                      </p>
                    </div>
                  </div>
                  {a.pendingInvitation ? (
                    <div className="flex items-center gap-2 rounded-full bg-info/10 px-3 py-1 text-xs text-info">
                      <Clock className="h-3 w-3" />
                      Invitación enviada a {a.pendingInvitation.email}
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 border-t pt-4">
                  <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />
                    {a.pendingInvitation
                      ? 'Reenviar invitación a otro email'
                      : 'Enviar invitación'}
                  </p>
                  <InviteAthleteForm
                    athleteId={a.id}
                    defaultEmail={a.pendingInvitation?.email ?? ''}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
