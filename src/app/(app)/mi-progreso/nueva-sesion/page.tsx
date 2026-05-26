import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { Role } from '@prisma/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { NewSelfSessionTemplates } from '@/components/athlete/NewSelfSessionTemplates';
import { AthleteSelfSessionForm } from '@/components/athlete/AthleteSelfSessionForm';
import { PageHeader, SectionHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default async function NuevaSesionPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== Role.ATHLETE) redirect('/equipo');

  const athlete = await db.athlete.findFirst({
    where: { userId: session.user.id, active: true },
    select: { id: true }
  });

  if (!athlete) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Nueva sesión"
          title="Empieza a entrenar"
          description="Captura tus flechas en tiempo real"
        />
        <EmptyState
          title="Tu cuenta no tiene un perfil de deportista vinculado"
          description="Pide a tu coach o administrador que cree tu perfil."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/mi-progreso"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Volver a Mi Progreso
        </Link>
        <PageHeader
          eyebrow="Nueva sesión"
          title="Empieza a entrenar"
          description="Elige una plantilla rápida o configura los detalles a tu medida"
        />
      </div>

      <section>
        <SectionHeader
          title="Plantillas rápidas"
          description="Toca una y empieza a capturar"
        />
        <NewSelfSessionTemplates />
      </section>

      <section>
        <details className="group rounded-2xl border bg-card p-4 shadow-sm">
          <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium">
            <span>Configurar manualmente</span>
            <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-4 border-t pt-4">
            <AthleteSelfSessionForm />
          </div>
        </details>
      </section>
    </div>
  );
}
