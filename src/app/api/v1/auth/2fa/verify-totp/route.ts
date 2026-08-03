import speakeasy from 'speakeasy';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils';
import { logAudit } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();
    const { token } = await request.json();
    if (!token || typeof token !== 'string') return errorResponse('Token required');
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) return errorResponse('2FA not set up', 400);
    const verified = speakeasy.totp.verify({ secret: user.totpSecret, encoding: 'base32', token, window: 1 });
    if (!verified) return errorResponse('Invalid code', 400);
    await prisma.user.update({ where: { id: userId }, data: { totpEnabled: true } });
    await logAudit({ actorId: userId, actorType: 'user', action: 'user.2fa_enabled', entityType: 'users', entityId: userId });
    return successResponse({ totpEnabled: true });
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}