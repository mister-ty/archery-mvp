import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { Plus, Mail, Shield, UserCog, Clock } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { listInvitations } from '@/server/actions/invitations';
import { RevokeInviteButton } from '@/components/admin/RevokeInviteButton';
import { PageHeader, SectionHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super admin',
  CLUB_ADMIN: 'Admin de club',
  COACH: 'Coach',
  ATHLETE: 'Deportista'
};

const ROLE_ICON: Record<Role, React.ReactNode> = {
  SUPER_ADMIN: <Shield className="h-3 w-3" />,
  CLUB_ADMIN: <Shield className="h-3 w-3" />,
  COACH: <UserCog className="h-3 w-3" />,
  ATHLETE: <Mail className="h-3 w-3" />
};

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const role = session.user.role;
  const canManage =
    role === Role.SUPER_ADMIN ||
    role === Role.CLUB_ADMIN ||
    role === Role.COACH;
  if (!canManage) redirect('/');

  // Users in scope
  const userWhere =
    role === Role.SUPER_ADMIN
      ? {}
      : { clubId: session.user.clubId ?? '__none__' };

  const [users, invitations] = await Promise.all([
    db.user.findMany({
      where: userWhere,
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
        club: { select: { name: true } },
        coachProfile: { select: { id: true, firstName: true, lastName: true } }
      },
      take: 200
    }),
    listInvitations()
  ]);

  const pending = invitations.filter((i) => !i.expired);
  const expired = invitations.filter((i) => i.expired);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administración"
        title="Usuarios e invitaciones"
        description={`${users.length} usuario${users.length === 1 ? '' : 's'} · ${pending.length} invitación${pending.length === 1 ? '' : 'es'} pendiente${pending.length === 1 ? '' : 's'}`}
        actions={
          <Link href="/admin/usuarios/nuevo" className="btn-primary h-10">
            <Plus className="h-4 w-4" />
            Nueva invitación
          </Link>
        }
      />

      {/* Pending invitations */}
      <section>
        <SectionHeader title={`Invitaciones pendientes (${pending.length})`} />
        {pending.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="Sin invitaciones pendientes"
            description="Crea una nueva invitación para sumar coaches o deportistas al club."
            compact
          />
        ) : (
          <ul className="divide-y rounded-xl border bg-card shadow-card overflow-hidden">
            {pending.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3 transition hover:bg-muted/30"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 shrink-0"
                    aria-hidden
                  >
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_LABEL[inv.role]} · {inv.clubName} · expira{' '}
                      {new Date(inv.expiresAt).toLocaleDateString('es-CO', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
                <RevokeInviteButton invitationId={inv.id} email={inv.email} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Expired invitations */}
      {expired.length > 0 && (
        <section>
          <SectionHeader title={`Invitaciones expiradas (${expired.length})`} />
          <ul className="divide-y rounded-xl border bg-card shadow-card overflow-hidden opacity-70">
            {expired.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-2 p-3"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className="grid h-9 w-9 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 shrink-0"
                    aria-hidden
                  >
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_LABEL[inv.role]} · expiró{' '}
                      {new Date(inv.expiresAt).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                </div>
                <RevokeInviteButton invitationId={inv.id} email={inv.email} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Active users */}
      <section>
        <SectionHeader title={`Usuarios (${users.length})`} />
        {users.length === 0 ? (
          <EmptyState title="No hay usuarios en tu alcance" compact />
        ) : (
          <ul className="divide-y rounded-xl border bg-card shadow-card overflow-hidden">
            {users.map((u) => {
              const displayName = u.coachProfile
                ? `${u.coachProfile.firstName} ${u.coachProfile.lastName}`
                : u.email.split('@')[0];
              return (
                <li
                  key={u.id}
                  className={`flex flex-wrap items-center justify-between gap-3 p-3 transition hover:bg-muted/30 ${
                    !u.active ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar name={displayName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {u.coachProfile && (
                          <>
                            {u.coachProfile.firstName} {u.coachProfile.lastName}
                            <span className="mx-1.5 text-muted-foreground/60">·</span>
                          </>
                        )}
                        <span className="font-normal text-muted-foreground">
                          {u.email}
                        </span>
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                          {ROLE_ICON[u.role]}
                          {ROLE_LABEL[u.role]}
                        </span>
                        <span>{u.club?.name ?? 'Sin club'}</span>
                        {!u.active && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-950/40 dark:text-red-400">
                            Inactivo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
