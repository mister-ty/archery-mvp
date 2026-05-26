'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker on first mount.
 * Silent on failure (private browsing, http://, devtools open, etc.).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Avoid registering during HMR / dev — Next.js dev server doesn't
    // serve `/sw.js` consistently and we don't want stale caches.
    if (process.env.NODE_ENV === 'development') return;

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {
          // ignore — registration is best-effort
        });
    };

    if (document.readyState === 'complete') {
      onLoad();
    } else {
      window.addEventListener('load', onLoad);
      return () => window.removeEventListener('load', onLoad);
    }
  }, []);

  return null;
}
