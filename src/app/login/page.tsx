'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const INPUT =
  'h-11 w-full rounded-lg border bg-background px-3.5 text-sm shadow-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:shadow-glow disabled:opacity-60';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') ?? '').trim().toLowerCase();
    const password = String(fd.get('password') ?? '');

    setLoading(true);
    const res = await signIn('credentials', {
      email,
      password,
      redirect: false
    });
    setLoading(false);

    if (res?.error) {
      toast.error('Credenciales inválidas');
      return;
    }
    toast.success('Sesión iniciada');
    router.push('/');
    router.refresh();
  }

  return (
    <main className="relative grid min-h-dvh place-items-center bg-brand-gradient px-4 py-12">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-6 animate-fade-in-scale">
        <div className="space-y-3 text-center">
          <Logo size="lg" showWordmark={false} className="mx-auto" />
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">Archery MVP</h1>
            <p className="text-sm text-muted-foreground">
              Seguimiento longitudinal de entrenamiento
            </p>
          </div>
        </div>

        <div className="card-elevated p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="tu@club.com"
                required
                className={INPUT}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                className={INPUT}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary h-11 w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ingresando…
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          ¿No tienes cuenta?{' '}
          <span className="font-medium text-foreground">
            Solicítala a tu administrador.
          </span>
        </p>
      </div>
    </main>
  );
}
