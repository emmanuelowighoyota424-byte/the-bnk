import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils';

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) return unauthorizedResponse();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return unauthorizedResponse();
    const secret = speakeasy.generateSecret({ name: `The Bnk:${user.email}`, length: 20 });
    await prisma.user.update({ where: { id: userId }, data: { totpSecret: secret.base32 } });
    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url!);
    return successResponse({ secret: secret.base32, qrCode: qrDataUrl, otpauthUrl: secret.otpauth_url });
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}