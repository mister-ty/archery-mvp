import Link from 'next/link';
import { Plus, UserRound, ChevronRight } from 'lucide-react';
import { listAthletes } from '@/server/actions/athletes';
import { PageHeader } from '@/components/ui/page-header';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';

export default async function AthletesPage() {
  const athletes = await listAthletes({ activeOnly: true });

  const count = athletes.length;
  const plural = count === 1 ? '' : 's';

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Deportistas"
        title="Roster del club"
        description={`${count} activo${plural}`}
        actions={
          <Link href="/deportistas/nuevo" className="btn-primary h-10">
            <Plus className="h-4 w-4" />
            <span>Nuevo</span>
          </Link>
        }
      />

      {athletes.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Aún no tienes deportistas"
          description="Crea el primero o invita a uno por email para que se una a tu club."
          action={
            <Link href="/deportistas/nuevo" className="btn-primary h-9">
              <Plus className="h-4 w-4" />
              Crear deportista
            </Link>
          }
        />
      ) : (
        <ul className="space-y-2">
          {athletes.map((a) => (
            <li key={a.id}>
              <Link
                href={`/deportistas/${a.id}`}
                className="group flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover"
              >
                <Avatar name={`${a.firstName} ${a.lastName}`} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {a.firstName} {a.lastName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">
                      {a.bowModality.name}
                    </span>{' '}
                    · {a.category.name}
                    {a.coach &&
                      ` · Coach ${a.coach.firstName} ${a.coach.lastName}`}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
