import prisma from '@/lib/prisma';
import { getCurrentUser, revokeAllUserSessions, revokeSession, getTokenFromCookie, verifyAccessToken } from '@/lib/auth';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    const sessions = await prisma.userSession.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, deviceInfo: true, ipAddress: true, location: true, createdAt: true, expiresAt: true }, orderBy: { createdAt: 'desc' } });
    return successResponse(sessions);
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      const session = await prisma.userSession.findFirst({ where: { id, userId: user.id, revokedAt: null }, select: { id: true } });
      if (!session) return errorResponse('Session not found', 404);
      await revokeSession(session.id);
      return successResponse({ revoked: true });
    }
    await revokeAllUserSessions(user.id);
    return successResponse({ revokedAll: true });
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}
