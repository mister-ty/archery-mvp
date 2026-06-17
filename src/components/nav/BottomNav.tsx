'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Plus, Trophy, UserCog, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type TabItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const STAFF_TABS: { left: TabItem[]; right: TabItem[]; fab: string } = {
  left: [
    { href: '/equipo', label: 'Equipo', icon: Home },
    { href: '/deportistas', label: 'Deportistas', icon: Users }
  ],
  right: [{ href: '/admin/usuarios', label: 'Usuarios', icon: UserCog }],
  fab: '/sesion/nueva'
};

// El FAB del atleta apunta a su flujo real de auto-sesión; /sesion/nueva
// es staff-only y antes era un callejón sin salida para este rol.
const ATHLETE_TABS: { left: TabItem[]; right: TabItem[]; fab: string } = {
  left: [{ href: '/mi-progreso', label: 'Inicio', icon: Home }],
  right: [{ href: '/mi-progreso#historial', label: 'Torneos', icon: Trophy }],
  fab: '/mi-progreso/nueva-sesion'
};

export function BottomNav({ isStaff }: { isStaff: boolean }) {
  const pathname = usePathname();
  const tabs = isStaff ? STAFF_TABS : ATHLETE_TABS;
  const cols = tabs.left.length + tabs.right.length + 1;

  const isActive = (href: string) => {
    // Anchor tabs (e.g. /mi-progreso#historial) never claim active state —
    // the pathname can't see the hash and would collide with "Inicio".
    if (href.includes('#')) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur sm:hidden"
      aria-label="Navegación móvil"
    >
      <ul
        className="grid px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {tabs.left.map((t) => (
          <TabLink key={t.href} tab={t} active={isActive(t.href)} />
        ))}
        <li className="grid place-items-center">
          <Link
            href={tabs.fab}
            aria-label="Nueva sesión"
            className="grid h-14 w-14 -translate-y-3 place-items-center rounded-full bg-primary text-primary-foreground shadow-card-hover ring-4 ring-background transition active:scale-95 hover:bg-primary-hover"
          >
            <Plus className="h-6 w-6" />
          </Link>
        </li>
        {tabs.right.map((t) => (
          <TabLink key={t.href} tab={t} active={isActive(t.href)} />
        ))}
      </ul>
    </nav>
  );
}

function TabLink({ tab, active }: { tab: TabItem; active: boolean }) {
  const Icon = tab.icon;
  return (
    <li className="grid place-items-center">
      <Link
        href={tab.href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition',
          active
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Icon className="h-5 w-5" />
        <span className={cn(active && 'font-semibold')}>{tab.label}</span>
      </Link>
    </li>
  );
}
