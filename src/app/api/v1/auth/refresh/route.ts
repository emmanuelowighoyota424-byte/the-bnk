import { signAccessToken, getTokenFromCookie, verifyToken, setTokenCookie, deleteTokenCookie } from '@/lib/auth';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils';
import prisma from '@/lib/prisma';

const REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me-in-production-32chars');

export async function POST() {
  try {
    const refreshToken = getTokenFromCookie('refresh_token');
    if (!refreshToken) return unauthorizedResponse('No refresh token');
    const payload = await verifyToken(refreshToken, REFRESH_SECRET);
    if (!payload || payload.type !== 'refresh') { deleteTokenCookie('access_token'); deleteTokenCookie('refresh_token'); return unauthorizedResponse('Invalid token'); }
    const session = await prisma.userSession.findFirst({ where: { userId: payload.sub, refreshTokenHash: refreshToken, revokedAt: null, expiresAt: { gt: new Date() } } });
    if (!session) { deleteTokenCookie('access_token'); deleteTokenCookie('refresh_token'); return unauthorizedResponse('Session expired'); }
    const newAccessToken = await signAccessToken({ sub: payload.sub, email: payload.email, role: payload.role });
    setTokenCookie('access_token', newAccessToken, 15*60);
    return successResponse({ refreshed: true });
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}