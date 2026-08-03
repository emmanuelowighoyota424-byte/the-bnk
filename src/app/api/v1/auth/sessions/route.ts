import prisma from '@/lib/prisma';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils';

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();
    const sessions = await prisma.userSession.findMany({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true, deviceInfo: true, ipAddress: true, location: true, createdAt: true, expiresAt: true }, orderBy: { createdAt: 'desc' } });
    return successResponse(sessions);
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}

export async function DELETE(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const sessionId = parts[parts.length-1];
    if (!sessionId || sessionId==='sessions') { await prisma.userSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }); return successResponse({ revokedAll: true }); }
    const session = await prisma.userSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) return errorResponse('Not found', 404);
    await prisma.userSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
    return successResponse({ revoked: true });
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}