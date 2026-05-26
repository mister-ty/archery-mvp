'use client';

import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

/**
 * Browser `beforeinstallprompt` event isn't typed by default.
 * We re-declare just the minimum surface we use.
 */
type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISS_KEY = 'pwa-install-dismissed-at';
// Re-prompt after 14 days if dismissed.
const REPROMPT_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

function wasRecentlyDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    if (Number.isNaN(dismissedAt)) return false;
    return Date.now() - dismissedAt < REPROMPT_AFTER_MS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (wasRecentlyDismissed()) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  const handleInstall = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'dismissed') markDismissed();
    } finally {
      setDeferred(null);
    }
  };

  const handleDismiss = () => {
    markDismissed();
    setDeferred(null);
  };

  return (
    <div
      className="fixed inset-x-3 bottom-24 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm z-40 animate-slide-up-in"
      role="dialog"
      aria-label="Instalar Archery"
    >
      <div className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-card-hover">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-[hsl(var(--primary-hover))] text-primary-foreground"
          aria-hidden
        >
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Instala Archery</p>
          <p className="text-xs text-muted-foreground">
            Usa la app como nativa y guarda capturas offline.
          </p>
        </div>
        <button
          type="button"
          onClick={handleInstall}
          className="btn-primary h-9 shrink-0"
        >
          Instalar
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
