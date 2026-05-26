import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { InviteForm } from '@/components/admin/InviteForm';

export default async function NewInvitationPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const role = session.user.role;
  const canManage =
    role === Role.SUPER_ADMIN ||
    role === Role.CLUB_ADMIN ||
    role === Role.COACH;
  if (!canManage) redirect('/');

  // Scope clubs the caller can invite to.
  const clubs = await db.club.findMany({
    where:
      role === Role.SUPER_ADMIN
        ? { active: true }
        : { id: session.user.clubId ?? '__none__' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' }
  });

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div>
        <Link
          href="/admin/usuarios"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← Usuarios
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-bold">Nueva invitación</h1>
        <p className="text-xs text-muted-foreground">
          Genera un link de activación para que el usuario cree su cuenta.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <InviteForm
          callerRole={role}
          callerClubId={session.user.clubId}
          clubs={clubs}
        />
      </div>
    </div>
  );
}
