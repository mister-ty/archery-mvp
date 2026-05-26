import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { UserCog } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { CoachOnboardingForm } from '@/components/onboarding/CoachOnboardingForm';

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  if (session.user.role !== Role.COACH) {
    redirect('/');
  }

  const coach = await db.coach.findUnique({
    where: { userId: session.user.id },
    select: { id: true }
  });
  if (coach) redirect('/equipo');

  return (
    <div className="mx-auto max-w-md space-y-6 py-6 sm:py-12 animate-fade-in-up">
      <div className="space-y-3 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-primary-foreground shadow-sm">
          <UserCog className="h-7 w-7" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Completa tu perfil de coach
          </h1>
          <p className="text-sm text-muted-foreground">
            Necesario antes de crear sesiones grupales y evaluar deportistas.
          </p>
        </div>
      </div>

      <div className="card-elevated p-6">
        <CoachOnboardingForm />
      </div>
    </div>
  );
}
