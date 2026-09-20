import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from './lib/auth';

const PUBLIC_PATHS = ['/','/login','/register','/admin/login','/api/v1/auth/register','/api/v1/auth/login','/api/v1/auth/refresh','/api/v1/admin/login','/_next','/favicon.ico','/api/health'];
const ADMIN_PATHS = ['/admin','/api/v1/admin'];

function isPublicPath(pathname: string): boolean { return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)); }
function isAdminPath(pathname: string): boolean { return ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)); }

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const adminPath = isAdminPath(pathname);

  // Administrator routes have their own isolated authentication cookie.
  // Never require the customer access_token for /admin or /api/v1/admin.
  if (adminPath) {
    const adminAccessToken = request.cookies.get('admin_access_token')?.value;
    if (!adminAccessToken) {
      if (pathname.startsWith('/api/')) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    const payload = await verifyAccessToken(adminAccessToken);
    if (!payload || payload.role !== 'admin' || !payload.sub) {
      const response = pathname.startsWith('/api/')
        ? NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        : NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.set('admin_access_token', '', { maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
      response.cookies.set('admin_refresh_token', '', { maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
      return response;
    }

    return NextResponse.next();
  }

  const accessToken = request.cookies.get('access_token')?.value;
  if (!accessToken) {
    if (pathname.startsWith('/api/')) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const payload = await verifyAccessToken(accessToken);
  if (!payload || !payload.sub) {
    const response = pathname.startsWith('/api/')
      ? NextResponse.json({ success: false, error: 'Token expired' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));
    response.cookies.set('access_token', '', { maxAge: 0, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
    return response;
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
