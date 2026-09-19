import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    const sessions = await prisma.userSession.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, deviceInfo: true, ipAddress: true, location: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(sessions);
  } catch (e) {
    console.error(e);
    return errorResponse('Internal server error', 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('id');

    if (!sessionId) {
      await prisma.userSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
      return successResponse({ revokedAll: true });
    }

    const session = await prisma.userSession.findFirst({ where: { id: sessionId, userId: user.id, revokedAt: null } });
    if (!session) return errorResponse('Session not found', 404);
    await prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return successResponse({ revoked: true });
  } catch (e) {
    console.error(e);
    return errorResponse('Internal server error', 500);
  }
}
