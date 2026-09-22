import { signAccessToken, getTokenFromCookie, verifyRefreshToken, setTokenCookie, deleteTokenCookie, revokeSession } from '@/lib/auth';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils';
import prisma from '@/lib/prisma';
import { createHash, randomBytes } from 'node:crypto';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function POST() {
  try {
    const refreshToken = getTokenFromCookie('refresh_token');
    if (!refreshToken) return unauthorizedResponse('Unauthorized');
    const payload = await verifyRefreshToken(refreshToken);
    if (!payload || payload.type !== 'refresh' || !payload.sub) return unauthorizedResponse('Unauthorized');

    const session = await prisma.userSession.findFirst({
      where: { ...(payload.sid ? { id: payload.sid } : { userId: payload.sub }), userId: payload.sub, refreshTokenHash: hashToken(refreshToken), revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, email: true, status: true } } },
    });
    if (!session || session.user.status !== 'active') {
      deleteTokenCookie('access_token'); deleteTokenCookie('refresh_token'); return unauthorizedResponse('Session expired');
    }

    const nextRefresh = randomBytes(32).toString('base64url');
    const rotated = await prisma.userSession.update({ where: { id: session.id }, data: { refreshTokenHash: hashToken(nextRefresh) }, select: { id: true } });
    const access = await signAccessToken({ sub: session.user.id, email: session.user.email, role: payload.role, sid: rotated.id });
    const refresh = await (async () => {
      const { signRefreshToken } = await import('@/lib/auth');
      return signRefreshToken({ sub: session.user.id, email: session.user.email, role: payload.role, sid: rotated.id });
    })();
    await prisma.userSession.update({ where: { id: rotated.id }, data: { refreshTokenHash: hashToken(refresh) } });
    setTokenCookie('access_token', access, 15 * 60);
    setTokenCookie('refresh_token', refresh, 7 * 24 * 60 * 60);
    return successResponse({ refreshed: true });
  } catch (e) { console.error(e); return unauthorizedResponse('Unauthorized'); }
}
