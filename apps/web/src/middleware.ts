import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Las rutas públicas que no requieren autenticación
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Permitir rutas de assets estáticos
  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));

  // El auth token se verifica en el cliente (localStorage/Zustand).
  // En el middleware solo redirigimos si estamos en ruta pública con cookie de auth (SSR).
  // La protección principal es en el DashboardLayout (client-side).
  if (isPublic) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
