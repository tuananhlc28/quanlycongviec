import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

export default async function middleware(request: NextRequest) {
  const session = await auth();
  const { pathname } = request.nextUrl;

  // Public routes
  const publicRoutes = ['/', '/login', '/register', '/products'];
  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    pathname.startsWith('/products/') ||
    pathname.startsWith('/api/auth');

  // Auth pages (login/register) - redirect to home if already logged in
  if ((pathname === '/login' || pathname === '/register') && session?.user) {
    const role = session.user.role;
    if (role === 'ADMIN' || role === 'STAFF') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    if (role === 'AGENT' || role === 'CTV') {
      return NextResponse.redirect(new URL('/agent/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Public routes don't need auth
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Protected routes - redirect to login if not authenticated
  if (!session?.user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = session.user.role;

  // Admin routes
  if (pathname.startsWith('/admin')) {
    if (role !== 'ADMIN' && role !== 'STAFF') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // Agent routes
  if (pathname.startsWith('/agent')) {
    if (role !== 'AGENT' && role !== 'CTV' && role !== 'ADMIN' && role !== 'STAFF') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
