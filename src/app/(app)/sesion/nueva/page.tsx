import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { auth } from '@/lib/auth';
import { listAthletes } from '@/server/actions/athletes';
import SessionForm from '@/components/sessions/SessionForm';

export default async function NewSessionPage() {
  const session = await auth();
  if (!session) redirect('/login');

  if (
    !([Role.COACH, Role.CLUB_ADMIN, Role.SUPER_ADMIN] as Role[]).includes(
      session.user.role
    )
  ) {
    return (
      <div className="rounded-xl border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Solo coaches y administradores pueden crear sesiones en esta fase.
        </p>
      </div>
    );
  }

  const athletes = await listAthletes({ activeOnly: true });

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">Nueva sesión</h1>
      <SessionForm athletes={athletes} />
    </div>
  );
}
