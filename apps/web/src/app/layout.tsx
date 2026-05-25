import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'SisTesis - Sistema de Gestión de Tesis', template: '%s | SisTesis' },
  description: 'Plataforma inteligente de gestión y evaluación automatizada de avances de tesis universitarias',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
