import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { auth } from '@/lib/auth';
import { listAthletes } from '@/server/actions/athletes';
import SessionForm from '@/components/sessions/SessionForm';
import { PageHeader } from '@/components/ui/page-header';

export default async function NewSessionPage() {
  const session = await auth();
  if (!session) redirect('/login');

  // Athletes have their own self-session flow — send them there instead
  // of showing a dead-end "staff only" message.
  if (
    !([Role.COACH, Role.CLUB_ADMIN, Role.SUPER_ADMIN] as Role[]).includes(
      session.user.role
    )
  ) {
    redirect('/mi-progreso/nueva-sesion');
  }

  const athletes = await listAthletes({ activeOnly: true });

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader
        eyebrow="Sesión"
        title="Nueva sesión"
        description="Selecciona deportistas, tipo y distancias para empezar a capturar"
      />
      <SessionForm athletes={athletes} />
    </div>
  );
}
