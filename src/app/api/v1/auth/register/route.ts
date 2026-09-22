import { z } from 'zod';
import { generateAccountNumber } from '@/lib/account-number';
import prisma from '@/lib/prisma';
import { hashPassword, validatePasswordStrength } from '@/lib/auth/password-utils';
import { consumePersistentRateLimit } from '@/lib/auth/challenge';
import { createAuthenticatedSession, logAudit } from '@/lib/auth';
import { successResponse, errorResponse, validateBody } from '@/lib/api-utils';

const schema = z.object({
  email: z.string().email().max(254), password: z.string().min(12).max(128),
  firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(32).optional(),
});

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!(await consumePersistentRateLimit(`register:ip:${ip}`, 5, 15 * 60 * 1000))) return errorResponse('Too many requests. Try again later.', 429);
    const v = validateBody(schema, await request.json());
    if (!v.success) return errorResponse('Validation failed', 400, v.errors);
    const strength = validatePasswordStrength(v.data.password);
    if (!strength.isStrong) return errorResponse('Password does not meet security requirements', 400, { password: strength.errors });
    const email = v.data.email.trim().toLowerCase();
    const base = `${v.data.firstName.toLowerCase()}.${v.data.lastName.toLowerCase()}`.replace(/[^a-z0-9.]/g, '') || 'customer';
    const passwordHash = await hashPassword(v.data.password);
    let created: { id: string; email: string; firstName: string; lastName: string; bnkTag: string | null } | null = null;

    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const bnkTag = attempt === 0 ? base : `${base}${attempt}`;
      try {
        created = await prisma.$transaction(async tx => {
          const user = await tx.user.create({ data: { email, passwordHash, firstName: v.data.firstName.trim(), lastName: v.data.lastName.trim(), phone: v.data.phone || null, bnkTag, status: 'active', kycStatus: 'pending', kycTier: 0 } });
          await tx.account.create({ data: { userId: user.id, accountType: 'checking', accountNumber: generateAccountNumber(), currency: 'USD', balance: 0, availableBalance: 0, status: 'active' } });
          return { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, bnkTag: user.bnkTag };
        });
      } catch (e) {
        if ((e as { code?: string }).code !== 'P2002') throw e;
      }
    }
    if (!created) return errorResponse('Unable to create account', 503);
    await createAuthenticatedSession(created.id, created.email, ip, request.headers.get('user-agent') || undefined);
    await logAudit({ actorId: created.id, actorType: 'user', action: 'REGISTER', entityType: 'users', entityId: created.id, ipAddress: ip });
    return successResponse({ user: created }, 201);
  } catch (e) {
    console.error(e);
    return errorResponse('Internal server error', 500);
  }
}
