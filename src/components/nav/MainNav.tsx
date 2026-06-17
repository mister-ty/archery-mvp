'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type NavLink = { href: string; label: string };

const STAFF_LINKS: NavLink[] = [
  { href: '/equipo', label: 'Equipo' },
  { href: '/deportistas', label: 'Deportistas' },
  { href: '/admin/usuarios', label: 'Usuarios' }
];

const ATHLETE_LINKS: NavLink[] = [
  { href: '/mi-progreso', label: 'Mi progreso' }
];

/**
 * Primary navigation for >= sm viewports. The bottom tab bar is mobile-only,
 * so without this, desktop users had no way to move between sections.
 */
export function MainNav({ isStaff }: { isStaff: boolean }) {
  const pathname = usePathname();
  const links = isStaff ? STAFF_LINKS : ATHLETE_LINKS;

  return (
    <nav
      className="hidden items-center gap-1 sm:flex"
      aria-label="Navegación principal"
    >
      {links.map((l) => {
        const active =
          pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-lg px-2.5 py-1.5 text-xs font-medium transition',
              active
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
