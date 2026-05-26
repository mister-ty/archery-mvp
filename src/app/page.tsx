import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  if (session.user.role === Role.ATHLETE) {
    redirect('/mi-progreso');
  }

  // Coaches need a Coach profile to use group-session features.
  if (session.user.role === Role.COACH) {
    const coach = await db.coach.findUnique({
      where: { userId: session.user.id },
      select: { id: true }
    });
    redirect(coach ? '/equipo' : '/onboarding');
  }

  // CLUB_ADMIN and SUPER_ADMIN land on the team dashboard.
  redirect('/equipo');
}
