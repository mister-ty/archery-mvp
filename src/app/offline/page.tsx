import { CloudOff, RefreshCcw } from 'lucide-react';
import { Logo } from '@/components/ui/logo';

export const dynamic = 'force-static';

export const metadata = {
  title: 'Sin conexión · Archery MVP',
  description: 'No hay conexión a internet'
};

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-brand-gradient px-4 py-12">
      <div className="w-full max-w-sm space-y-6 text-center animate-fade-in-scale">
        <Logo size="lg" showWordmark={false} className="mx-auto" />
        <div className="space-y-3">
          <div
            className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground"
            aria-hidden
          >
            <CloudOff className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Sin conexión</h1>
            <p className="text-sm text-muted-foreground">
              No podemos cargar esta página ahora mismo. Tus flechas capturadas
              en F4 siguen guardadas localmente y se sincronizarán automáticamente
              cuando vuelvas a estar en línea.
            </p>
          </div>
        </div>

        <a href="/" className="btn-outline h-11 w-full">
          <RefreshCcw className="h-4 w-4" />
          Reintentar
        </a>
      </div>
    </main>
  );
}
