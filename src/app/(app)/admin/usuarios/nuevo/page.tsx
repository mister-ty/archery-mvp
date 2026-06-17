import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { ChevronLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { InviteForm } from '@/components/admin/InviteForm';
import { PageHeader } from '@/components/ui/page-header';

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
    <div className="mx-auto max-w-md space-y-6">
      <Link
        href="/admin/usuarios"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
      >
        <ChevronLeft className="h-3 w-3" />
        Usuarios
      </Link>

      <PageHeader
        eyebrow="Administración"
        title="Nueva invitación"
        description="Genera un link de activación para que el usuario cree su cuenta"
      />

      <div className="rounded-xl border bg-card p-4 shadow-card">
        <InviteForm
          callerRole={role}
          callerClubId={session.user.clubId}
          clubs={clubs}
        />
      </div>
    </div>
  );
}
