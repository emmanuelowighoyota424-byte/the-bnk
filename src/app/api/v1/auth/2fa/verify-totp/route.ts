import speakeasy from 'speakeasy';
import prisma from '@/lib/prisma';
import { getChallenge, consumeChallenge, recordChallengeFailure } from '@/lib/auth/challenge';
import { createAuthenticatedSession, logAudit } from '@/lib/auth';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { challengeId?: string; token?: string };
    const challengeId = String(body.challengeId || '');
    const token = String(body.token || '').trim();
    if (!challengeId || !/^\d{6}$/.test(token)) return errorResponse('Challenge and token are required', 400);

    const challenge = await getChallenge(challengeId, 'LOGIN_2FA');
    if (!challenge || challenge.type !== 'TOTP') return unauthorizedResponse('Invalid or expired challenge');

    const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
    if (!user || user.status !== 'active' || !user.totpEnabled || !user.totpSecret) return unauthorizedResponse('Invalid authentication challenge');

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const ua = request.headers.get('user-agent') || undefined;
    const allowed = await (await import('@/lib/auth/challenge')).consumePersistentRateLimit(`totp:${ip}:${challenge.userId}`, 5, 5 * 60 * 1000);
    if (!allowed) return errorResponse('Too many attempts. Try again later.', 429);

    const valid = speakeasy.totp.verify({ secret: user.totpSecret, encoding: 'base32', token, window: 1 });
    if (!valid) {
      const failure = await recordChallengeFailure(challenge.id, 'LOGIN_2FA', user.id);
      await logAudit({ actorId: user.id, actorType: 'user', action: 'TOTP_FAILURE', entityType: 'auth_challenges', entityId: challenge.id, ipAddress: ip, userAgent: ua });
      return unauthorizedResponse(failure.locked ? 'Challenge locked' : 'Invalid code');
    }
    if (!(await consumeChallenge(challenge.id, 'LOGIN_2FA', user.id))) return unauthorizedResponse('Challenge already used');

    await createAuthenticatedSession(user.id, user.email, ip, ua);
    await logAudit({ actorId: user.id, actorType: 'user', action: 'LOGIN_SUCCESS', entityType: 'users', entityId: user.id, ipAddress: ip, userAgent: ua });
    return successResponse({ authenticated: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}
