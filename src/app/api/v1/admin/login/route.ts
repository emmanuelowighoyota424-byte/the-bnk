import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { signAccessToken, setTokenCookie, logAudit, checkRateLimit } from '@/lib/auth';
import { successResponse, errorResponse, validateBody, unauthorizedResponse } from '@/lib/api-utils';
import { randomBytes, createHash } from 'node:crypto';

const adminLoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

const SUPER_ADMIN_PERMISSIONS = [
  'users.read', 'users.write', 'users.suspend', 'kyc.review', 'kyc.approve', 'kyc.reject',
  'transactions.read', 'transactions.adjust', 'cards.read', 'cards.manage', 'disputes.read',
  'disputes.manage', 'disputes.resolve', 'fraud.alerts.read', 'fraud.alerts.manage',
  'fraud.rules.manage', 'compliance.sar', 'compliance.aml', 'roles.read', 'roles.write',
  'admins.read', 'admins.write', 'metrics.read', 'audit.read', 'communications.send', 'system.config',
];

async function ensureConfiguredAdmin(email: string) {
  const configuredEmail = (process.env.ADMIN_EMAIL || 'owighoyotaemmanuel424@gmail.com').trim().toLowerCase();
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword || email !== configuredEmail) return null;

  const role = await prisma.role.upsert({
    where: { name: 'Super Admin' },
    update: { permissions: SUPER_ADMIN_PERMISSIONS },
    create: {
      name: 'Super Admin',
      description: 'Full system access with all permissions',
      permissions: SUPER_ADMIN_PERMISSIONS,
    },
  });

  const existing = await prisma.adminUser.findUnique({ where: { email: configuredEmail } });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(configuredPassword, 12);
  return prisma.adminUser.create({
    data: {
      email: configuredEmail,
      passwordHash,
      displayName: 'Crestline Administrator',
      roleId: role.id,
      status: 'active',
    },
  });
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(`admin-login:${ip}`, 10, 15 * 60 * 1000)) return errorResponse('Too many attempts', 429);

    const body = await request.json();
    const v = validateBody(adminLoginSchema, body);
    if (!v.success) return errorResponse('Validation failed', 400, v.errors);

    const email = v.data.email.trim().toLowerCase();
    const password = v.data.password;
    let admin = await prisma.adminUser.findUnique({ where: { email }, include: { role: true } });

    if (!admin) {
      const provisioned = await ensureConfiguredAdmin(email);
      if (provisioned) admin = await prisma.adminUser.findUnique({ where: { id: provisioned.id }, include: { role: true } });
    }

    if (!admin || admin.status !== 'active') return unauthorizedResponse('Invalid credentials');
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return unauthorizedResponse('Invalid credentials');

    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    const refreshToken = randomBytes(32).toString('base64url');
    const session = await prisma.adminSession.create({ data: { adminId: admin.id, tokenHash: createHash('sha256').update(refreshToken).digest('hex'), ipAddress: ip, userAgent: request.headers.get('user-agent') || undefined, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }, select: { id: true } });
    const accessToken = await signAccessToken({ sub: admin.id, email: admin.email, role: 'admin', sid: session.id });

    // Keep administrator authentication separate from the customer access cookie.
    // This prevents a customer login/logout or token refresh from replacing an admin session.
    setTokenCookie('admin_access_token', accessToken, 15 * 60);
    setTokenCookie('admin_refresh_token', refreshToken, 7 * 24 * 60 * 60);

    await logAudit({ actorId: admin.id, actorType: 'admin', action: 'admin.login', entityType: 'admin_users', entityId: admin.id, ipAddress: ip });

    return successResponse({
      admin: {
        id: admin.id,
        email: admin.email,
        displayName: admin.displayName,
        role: admin.role.name,
        permissions: admin.role.permissions,
      },
    });
  } catch (e) {
    console.error(e);
    return errorResponse('Internal server error', 500);
  }
}
