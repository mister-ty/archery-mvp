import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { auth, signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  Home,
  Users,
  Trophy,
  ClipboardList,
  LogOut,
  Plus,
  UserCog
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Avatar } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { InstallPrompt } from '@/components/pwa/install-prompt';

export default async function AppLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const role = session.user.role;
  const isStaff =
    role === Role.COACH ||
    role === Role.CLUB_ADMIN ||
    role === Role.SUPER_ADMIN;

  // Best-effort display name from the Coach profile (if any). Falls back
  // to the email local-part. Single optional query — no impact when the
  // user has no Coach record (athletes / admins without setup).
  let displayName: string | null = null;
  if (role === Role.COACH || role === Role.SUPER_ADMIN || role === Role.CLUB_ADMIN) {
    const coach = await db.coach.findUnique({
      where: { userId: session.user.id },
      select: { firstName: true, lastName: true }
    });
    if (coach) displayName = `${coach.firstName} ${coach.lastName}`;
  }
  const friendlyName = displayName ?? session.user.email.split('@')[0];

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b bg-card/85 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-14 items-center justify-between gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 transition hover:opacity-80"
            aria-label="Ir al inicio"
          >
            <Logo size="sm" showWordmark />
          </Link>

          <div className="flex items-center gap-1">
            {isStaff && (
              <Link
                href="/admin/usuarios"
                className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex"
              >
                <UserCog className="h-3.5 w-3.5" />
                Usuarios
              </Link>
            )}

            <div className="hidden items-center gap-2 rounded-lg pl-1.5 pr-2 py-1 text-xs sm:flex">
              <Avatar name={friendlyName} size="xs" />
              <span className="text-foreground/80 max-w-[180px] truncate">
                {friendlyName}
              </span>
            </div>

            <ThemeToggle />

            <form
              action={async () => {
                'use server';
                await signOut({ redirectTo: '/login' });
              }}
            >
              <button
                type="submit"
                className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Cerrar sesión"
                title="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container flex-1 py-6 pb-28 sm:pb-10 animate-fade-in-up">
        {children}
      </main>

      {/* PWA install prompt — auto-hides if browser doesn't support it
          or if the user has already installed/dismissed recently. */}
      <InstallPrompt />

      {/* Bottom tab bar (mobile) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur sm:hidden"
        aria-label="Navegación principal"
      >
        <ul className="grid grid-cols-5 px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
          <TabLink
            href={isStaff ? '/equipo' : '/mi-progreso'}
            label="Inicio"
            icon={<Home className="h-5 w-5" />}
          />
          {isStaff ? (
            <TabLink
              href="/deportistas"
              label="Deportistas"
              icon={<Users className="h-5 w-5" />}
            />
          ) : (
            <TabLink
              href="/mi-progreso"
              label="Progreso"
              icon={<ClipboardList className="h-5 w-5" />}
            />
          )}
          <li className="grid place-items-center">
            <Link
              href="/sesion/nueva"
              aria-label="Nueva sesión"
              className="grid h-14 w-14 -translate-y-3 place-items-center rounded-full bg-primary text-primary-foreground shadow-card-hover ring-4 ring-background transition active:scale-95 hover:bg-primary-hover"
            >
              <Plus className="h-6 w-6" />
            </Link>
          </li>
          {isStaff ? (
            <TabLink
              href="/admin/usuarios"
              label="Usuarios"
              icon={<UserCog className="h-5 w-5" />}
            />
          ) : (
            <TabLink
              href="/mi-progreso#historial"
              label="Torneos"
              icon={<Trophy className="h-5 w-5" />}
            />
          )}
          <TabLink
            href="/mi-progreso"
            label="Yo"
            icon={<Avatar name={friendlyName} size="xs" className="!h-5 !w-5" />}
          />
        </ul>
      </nav>
    </div>
  );
}

function TabLink({
  href,
  label,
  icon
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <li className="grid place-items-center">
      <Link
        href={href}
        className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground transition hover:text-foreground"
      >
        {icon}
        <span>{label}</span>
      </Link>
    </li>
  );
}
