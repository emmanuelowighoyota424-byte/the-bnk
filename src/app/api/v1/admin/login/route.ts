import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { signAccessToken, signRefreshToken, setTokenCookie, logAudit, checkRateLimit } from '@/lib/auth';
import { successResponse, errorResponse, validateBody, unauthorizedResponse } from '@/lib/api-utils';

const adminLoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(`admin-login:${ip}`, 100, 15*60*1000)) return errorResponse('Too many attempts', 429);
    const body = await request.json();
    const v = validateBody(adminLoginSchema, body);
    if (!v.success) return errorResponse('Validation failed', 400, v.errors);
    const { email, password } = v.data;
    const admin = await prisma.adminUser.findUnique({ where: { email }, include: { role: true } });
    if (!admin || admin.status!=='active') return unauthorizedResponse('Invalid credentials');
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return unauthorizedResponse('Invalid credentials');
    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    const accessToken = await signAccessToken({ sub: admin.id, email: admin.email, role: 'admin' });
    const refreshToken = await signRefreshToken({ sub: admin.id, email: admin.email, role: 'admin' });
    setTokenCookie('access_token', accessToken, 15*60);
    setTokenCookie('refresh_token', refreshToken, 7*24*60*60);
    await logAudit({ actorId: admin.id, actorType: 'admin', action: 'admin.login', entityType: 'admin_users', entityId: admin.id, ipAddress: ip });
    return successResponse({ admin: { id: admin.id, email: admin.email, displayName: admin.displayName, role: admin.role.name, permissions: admin.role.permissions } });
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}