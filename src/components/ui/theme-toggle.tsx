'use client';

import { useEffect, useRef, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

type Theme = 'light' | 'dark' | 'system';
type Resolved = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function getSystemTheme(): Resolved {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'dark' || v === 'light') return v;
  } catch {
    // ignore
  }
  return 'system';
}

function applyTheme(theme: Theme): Resolved {
  const resolved: Resolved = theme === 'system' ? getSystemTheme() : theme;
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.style.colorScheme = resolved;
  }
  return resolved;
}

function persistTheme(theme: Theme) {
  try {
    if (theme === 'system') {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, theme);
    }
  } catch {
    // ignore (private mode / quota)
  }
}

type Props = {
  className?: string;
  /** Compact = icon-only round button; expanded shows the 3-state segmented control. */
  variant?: 'compact' | 'segmented';
};

export function ThemeToggle({ className, variant = 'compact' }: Props) {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);
  // Ref mirrors `theme` so the click handler can read the up-to-date
  // value even before React has committed the previous setState. Fixes
  // a race when the user clicks the cycle button twice in rapid succession.
  const themeRef = useRef<Theme>('system');

  // Hydration: read stored value on client only to avoid SSR mismatch.
  useEffect(() => {
    const t = readStoredTheme();
    themeRef.current = t;
    setTheme(t);
    setMounted(true);
  }, []);

  // Listen for OS-level changes while in "system" mode.
  useEffect(() => {
    if (theme !== 'system') return;
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [theme]);

  const setAndPersist = (next: Theme) => {
    themeRef.current = next;
    setTheme(next);
    persistTheme(next);
    applyTheme(next);
  };

  // Compute cycle target from the ref (always current) instead of from
  // the closure (stale on rapid double-clicks).
  const cycleNext = (): Theme => {
    const current = themeRef.current;
    if (current === 'light') return 'dark';
    if (current === 'dark') return 'system';
    return 'light';
  };

  // Render an inert button server-side / pre-hydration to match the DOM
  // size and avoid layout shift.
  if (!mounted) {
    return (
      <span
        className={cn(
          'grid h-9 w-9 place-items-center rounded-lg text-muted-foreground',
          className
        )}
        aria-hidden
      />
    );
  }

  if (variant === 'segmented') {
    return (
      <div
        className={cn(
          'inline-flex rounded-lg border bg-card p-0.5 text-xs',
          className
        )}
        role="radiogroup"
        aria-label="Tema"
      >
        {(
          [
            { value: 'light' as const, label: 'Claro', icon: Sun },
            { value: 'system' as const, label: 'Sistema', icon: Monitor },
            { value: 'dark' as const, label: 'Oscuro', icon: Moon }
          ]
        ).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            onClick={() => setAndPersist(value)}
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-md px-2 transition',
              theme === value
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    );
  }

  // Compact: single button cycling light → dark → system.
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const label =
    theme === 'light'
      ? 'Tema claro (clic para oscuro)'
      : theme === 'dark'
        ? 'Tema oscuro (clic para sistema)'
        : 'Tema del sistema (clic para claro)';

  return (
    <button
      type="button"
      onClick={() => setAndPersist(cycleNext())}
      className={cn(
        'grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground',
        className
      )}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
