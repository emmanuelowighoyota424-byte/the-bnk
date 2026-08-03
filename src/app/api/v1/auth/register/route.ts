import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { signAccessToken, signRefreshToken, setTokenCookie, createUserSession, logAudit, checkRateLimit } from '@/lib/auth';
import { successResponse, errorResponse, validateBody } from '@/lib/api-utils';

const registerSchema = z.object({ email: z.string().email(), password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/), firstName: z.string().min(1), lastName: z.string().min(1), phone: z.string().optional() });

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(`register:${ip}`, 5, 15*60*1000)) return errorResponse('Too many requests', 429);
    const body = await request.json();
    const v = validateBody(registerSchema, body);
    if (!v.success) return errorResponse('Validation failed', 400, v.errors);
    const { email, password, firstName, lastName, phone } = v.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return errorResponse('An account with this email already exists', 409);
    const passwordHash = await bcrypt.hash(password, 12);
    const baseTag = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/[^a-z0-9.]/g,'');
    let bnkTag = baseTag; let s=1;
    while (await prisma.user.findUnique({ where: { bnkTag } })) { bnkTag = `${baseTag}${s}`; s++; }
    const user = await prisma.user.create({ data: { email, passwordHash, firstName, lastName, phone, bnkTag, status: 'active', kycStatus: 'pending', kycTier: 0 } });
    const accessToken = await signAccessToken({ sub: user.id, email: user.email });
    const refreshToken = await signRefreshToken({ sub: user.id, email: user.email });
    await createUserSession(user.id, refreshToken, ip);
    setTokenCookie('access_token', accessToken, 15*60);
    setTokenCookie('refresh_token', refreshToken, 7*24*60*60);
    await logAudit({ actorId: user.id, actorType: 'user', action: 'user.register', entityType: 'users', entityId: user.id, ipAddress: ip });
    return successResponse({ user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, bnkTag: user.bnkTag, kycStatus: user.kycStatus, kycTier: user.kycTier } }, 201);
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}