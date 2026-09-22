import { z } from 'zod';
import prisma from '@/lib/prisma';
import { verifyAndUpgradePassword } from '@/lib/auth/password-utils';
import { createAuthChallenge, consumePersistentRateLimit } from '@/lib/auth/challenge';
import { createAuthenticatedSession, logAudit } from '@/lib/auth';
import { successResponse, errorResponse, validateBody, unauthorizedResponse } from '@/lib/api-utils';

const schema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) });

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ua = request.headers.get('user-agent') || undefined;
    const body = await request.json();
    const v = validateBody(schema, body);
    if (!v.success) return errorResponse('Validation failed', 400, v.errors);
    const email = v.data.email.trim().toLowerCase();

    const allowed = await consumePersistentRateLimit(`login:ip:${ip}`, 10, 15 * 60 * 1000)
      && await consumePersistentRateLimit(`login:email:${email}`, 10, 15 * 60 * 1000);
    if (!allowed) return errorResponse('Too many attempts. Try again later.', 429);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== 'active') return unauthorizedResponse('Invalid credentials');
    const result = await verifyAndUpgradePassword(v.data.password, user.passwordHash);
    if (!result.valid) {
      await logAudit({ actorId: user.id, actorType: 'user', action: 'LOGIN_FAILURE', entityType: 'users', entityId: user.id, ipAddress: ip, userAgent: ua });
      return unauthorizedResponse('Invalid credentials');
    }
    if (result.upgradedHash) await prisma.user.update({ where: { id: user.id }, data: { passwordHash: result.upgradedHash } });

    if (user.totpEnabled && user.totpSecret) {
      const challenge = await createAuthChallenge({ userId: user.id, purpose: 'LOGIN_2FA', type: 'TOTP', ipAddress: ip, userAgent: ua, maxAttempts: 5 });
      return successResponse({ requiresTotp: true, challengeId: challenge.id, expiresAt: challenge.expiresAt });
    }

    await createAuthenticatedSession(user.id, user.email, ip, ua);
    await logAudit({ actorId: user.id, actorType: 'user', action: 'LOGIN_SUCCESS', entityType: 'users', entityId: user.id, ipAddress: ip, userAgent: ua });
    return successResponse({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, bnkTag: user.bnkTag, kycStatus: user.kycStatus, kycTier: user.kycTier, status: user.status } });
  } catch (e) {
    console.error(e);
    return errorResponse('Internal server error', 500);
  }
}
