import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Role } from '@prisma/client';
import { auth, signOut } from '@/lib/auth';
import { db } from '@/lib/db';
import { LogOut } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Avatar } from '@/components/ui/avatar';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { MainNav } from '@/components/nav/MainNav';
import { BottomNav } from '@/components/nav/BottomNav';

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
          <div className="flex min-w-0 items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 transition hover:opacity-80"
              aria-label="Ir al inicio"
            >
              <Logo size="sm" showWordmark />
            </Link>
            <MainNav isStaff={isStaff} />
          </div>

          <div className="flex items-center gap-1">
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

      {/* Bottom tab bar (mobile) — role-aware with active state */}
      <BottomNav isStaff={isStaff} />
    </div>
  );
}
