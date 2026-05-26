import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import AthleteForm from '@/components/athletes/AthleteForm';

export default async function NewAthletePage() {
  const session = await auth();
  if (
    !session ||
    !([Role.COACH, Role.CLUB_ADMIN, Role.SUPER_ADMIN] as Role[]).includes(
      session.user.role
    )
  ) {
    redirect('/');
  }

  const [modalities, categories, coaches, clubs] = await Promise.all([
    db.bowModality.findMany({
      where: { active: true },
      orderBy: { name: 'asc' }
    }),
    db.category.findMany({
      where: { active: true },
      orderBy: { minAge: 'asc' }
    }),
    db.coach.findMany({
      where:
        session.user.role === Role.SUPER_ADMIN
          ? {}
          : { clubId: session.user.clubId ?? '' },
      select: { id: true, firstName: true, lastName: true, clubId: true }
    }),
    db.club.findMany({
      where:
        session.user.role === Role.SUPER_ADMIN
          ? { active: true }
          : { id: session.user.clubId ?? '' },
      select: { id: true, name: true }
    })
  ]);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">Nuevo deportista</h1>
      <AthleteForm
        modalities={modalities}
        categories={categories}
        coaches={coaches}
        clubs={clubs}
        defaultClubId={session.user.clubId ?? clubs[0]?.id ?? ''}
      />
    </div>
  );
}
