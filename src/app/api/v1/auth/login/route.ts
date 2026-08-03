import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { signAccessToken, signRefreshToken, setTokenCookie, createUserSession, logAudit, checkRateLimit } from '@/lib/auth';
import { successResponse, errorResponse, validateBody, unauthorizedResponse } from '@/lib/api-utils';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(`login:${ip}`, 100, 15*60*1000)) return errorResponse('Too many attempts', 429);
    const body = await request.json();
    const v = validateBody(loginSchema, body);
    if (!v.success) return errorResponse('Validation failed', 400, v.errors);
    const { email, password } = v.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.status==='suspended'||user.status==='closed') return unauthorizedResponse('Invalid credentials');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) { await logAudit({ actorId: user.id, actorType: 'user', action: 'user.login_failed', entityType: 'users', entityId: user.id, ipAddress: ip }); return unauthorizedResponse('Invalid credentials'); }
    if (user.totpEnabled) { const tempToken = await signAccessToken({ sub: user.id, email: user.email }); return successResponse({ requiresTotp: true, tempToken }); }
    const accessToken = await signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = await signRefreshToken({ sub: user.id, email: user.email });
    await createUserSession(user.id, refreshToken, ip);
    setTokenCookie('access_token', accessToken, 15*60);
    setTokenCookie('refresh_token', refreshToken, 7*24*60*60);
    await logAudit({ actorId: user.id, actorType: 'user', action: 'user.login', entityType: 'users', entityId: user.id, ipAddress: ip });
    return successResponse({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, bnkTag: user.bnkTag, kycStatus: user.kycStatus, kycTier: user.kycTier, status: user.status } });
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}