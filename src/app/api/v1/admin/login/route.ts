import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { signAccessToken, signRefreshToken, setTokenCookie, logAudit, checkRateLimit } from '@/lib/auth';
import { successResponse, errorResponse, validateBody, unauthorizedResponse } from '@/lib/api-utils';

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
    if (!checkRateLimit(`admin-login:${ip}`, 100, 15 * 60 * 1000)) return errorResponse('Too many attempts', 429);

    const body = await request.json();
    const v = validateBody(adminLoginSchema, body);
    if (!v.success) return errorResponse('Validation failed', 400, v.errors);

    const email = v.data.email.trim().toLowerCase();
    const password = v.data.password;

    let admin = await prisma.adminUser.findUnique({ where: { email }, include: { role: true } });

    // Production deployments may have migrations applied without ever running the seed.
    // Provision the explicitly configured bootstrap administrator on first login instead
    // of requiring a separate database-seeding operation. The password remains server-side
    // in ADMIN_PASSWORD and is never returned, logged, or committed.
    if (!admin) {
      const provisioned = await ensureConfiguredAdmin(email);
      if (provisioned) {
        admin = await prisma.adminUser.findUnique({ where: { id: provisioned.id }, include: { role: true } });
      }
    }

    if (!admin || admin.status !== 'active') return unauthorizedResponse('Invalid credentials');
    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) return unauthorizedResponse('Invalid credentials');

    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    const accessToken = await signAccessToken({ sub: admin.id, email: admin.email, role: 'admin' });
    const refreshToken = await signRefreshToken({ sub: admin.id, email: admin.email, role: 'admin' });
    setTokenCookie('access_token', accessToken, 15 * 60);
    setTokenCookie('refresh_token', refreshToken, 7 * 24 * 60 * 60);
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
