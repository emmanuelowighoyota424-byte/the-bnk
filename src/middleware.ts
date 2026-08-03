import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from './lib/auth';

const PUBLIC_PATHS = ['/','/login','/register','/admin/login','/api/v1/auth/register','/api/v1/auth/login','/api/v1/auth/refresh','/api/v1/admin/login','/_next','/favicon.ico','/api/health'];
const ADMIN_PATHS = ['/admin','/api/v1/admin'];

function isPublicPath(pathname: string): boolean { return PUBLIC_PATHS.some((p) => pathname.startsWith(p)); }
function isAdminPath(pathname: string): boolean { return ADMIN_PATHS.some((p) => pathname.startsWith(p)); }

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();
  const accessToken = request.cookies.get('access_token')?.value;
  if (!accessToken) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    const loginPath = isAdminPath(pathname) ? '/admin/login' : '/login';
    return NextResponse.redirect(new URL(loginPath, request.url));
  }
  const payload = await verifyAccessToken(accessToken);
  if (!payload) {
    const response = pathname.startsWith('/api/') ? NextResponse.json({ success: false, error: 'Token expired' }, { status: 401 }) : NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set('access_token', '', { maxAge: 0 });
    return response;
  }
  if (isAdminPath(pathname) && payload.role !== 'admin') {
    return pathname.startsWith('/api/') ? NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 }) : NextResponse.redirect(new URL('/admin/login', request.url));
  }
  if (pathname.startsWith('/api/')) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', payload.sub);
    requestHeaders.set('x-user-email', payload.email);
    requestHeaders.set('x-user-role', payload.role || 'user');
    return NextResponse.next({ request: { headers: requestHeaders } });
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };