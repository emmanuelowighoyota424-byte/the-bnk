import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import prisma from '@/lib/prisma';
import { getCurrentUser, logAudit } from '@/lib/auth';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    const secret = speakeasy.generateSecret({ name: `Crestline Capital:${user.email}`, length: 20 });
    await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret.base32, totpEnabled: false } });
    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);
    await logAudit({ actorId: user.id, actorType: 'user', action: '2FA_SETUP_STARTED', entityType: 'users', entityId: user.id });
    return successResponse({ secret: secret.base32, qrCode, otpauthUrl: secret.otpauth_url });
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}
