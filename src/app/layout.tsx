import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { ThemeInit } from '@/components/ui/theme-init';
import { ServiceWorkerRegister } from '@/components/pwa/sw-register';

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'Archery MVP',
  description: 'Seguimiento longitudinal de entrenamiento de tiro con arco',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Archery',
    statusBarStyle: 'default'
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192' }]
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#1a8a3f' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' }
  ]
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning className={cn("font-sans", inter.variable)}>
      <head>
        <ThemeInit />
      </head>
      <body className="min-h-dvh bg-background antialiased">
        <ServiceWorkerRegister />
        {children}
        <Toaster
          position="bottom-center"
          closeButton
          richColors
          toastOptions={{
            classNames: {
              toast:
                'group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-card-hover',
              description: 'group-[.toast]:text-muted-foreground',
              actionButton:
                'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
              cancelButton:
                'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground'
            }
          }}
        />
      </body>
    </html>
  );
}
