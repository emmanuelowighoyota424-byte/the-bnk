import { signAccessToken, getTokenFromCookie, verifyRefreshToken, setTokenCookie, deleteTokenCookie } from '@/lib/auth';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils';
import prisma from '@/lib/prisma';

export async function POST() {
  try {
    const refreshToken = getTokenFromCookie('refresh_token');
    if (!refreshToken) return unauthorizedResponse('No refresh token');
    const payload = await verifyRefreshToken(refreshToken);
    if (!payload || payload.type !== 'refresh' || !payload.sub) {
      deleteTokenCookie('access_token');
      deleteTokenCookie('refresh_token');
      return unauthorizedResponse('Invalid token');
    }
    const session = await prisma.userSession.findFirst({
      where: { userId: payload.sub, refreshTokenHash: refreshToken, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, email: true, status: true } } },
    });
    if (!session || session.user.status !== 'active') {
      deleteTokenCookie('access_token');
      deleteTokenCookie('refresh_token');
      return unauthorizedResponse('Session expired');
    }
    const newAccessToken = await signAccessToken({ sub: session.user.id, email: session.user.email, role: payload.role });
    setTokenCookie('access_token', newAccessToken, 15*60);
    return successResponse({ refreshed: true });
  } catch (e) {
    console.error(e);
    return errorResponse('Internal server error', 500);
  }
}
