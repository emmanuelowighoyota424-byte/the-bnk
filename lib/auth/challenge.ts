import crypto from 'node:crypto'
import prisma from '@/lib/prisma'
import { hashSecret } from './password-utils'

export type AuthChallengePurpose = 'LOGIN_2FA' | 'PASSWORD_RESET' | 'SENSITIVE_ACTION'
const TTL_MS = 5 * 60 * 1000

export async function createAuthChallenge(params: {
  userId: string; purpose: AuthChallengePurpose; type: string; ipAddress?: string; userAgent?: string; maxAttempts?: number
}) {
  const raw = crypto.randomBytes(32).toString('base64url')
  const challenge = await prisma.authChallenge.create({
    data: {
      userId: params.userId, purpose: params.purpose, type: params.type,
      challengeHash: hashSecret(raw), maxAttempts: params.maxAttempts ?? 5,
      expiresAt: new Date(Date.now() + TTL_MS), ipAddress: params.ipAddress, userAgent: params.userAgent,
    },
    select: { id: true, expiresAt: true },
  })
  return { id: challenge.id, secret: raw, expiresAt: challenge.expiresAt }
}

export async function getChallenge(id: string, purpose: AuthChallengePurpose) {
  return prisma.authChallenge.findFirst({ where: { id, purpose, consumedAt: null, expiresAt: { gt: new Date() } } })
}

export async function consumeChallenge(id: string, purpose: AuthChallengePurpose, userId: string) {
  const result = await prisma.authChallenge.updateMany({
    where: { id, userId, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    data: { consumedAt: new Date() },
  })
  return result.count === 1
}

export async function recordChallengeFailure(id: string, purpose: AuthChallengePurpose, userId: string) {
  return prisma.$transaction(async tx => {
    const current = await tx.authChallenge.findFirst({ where: { id, userId, purpose, consumedAt: null, expiresAt: { gt: new Date() } } })
    if (!current) return { valid: false, locked: true }
    const nextAttempts = current.attempts + 1
    const locked = nextAttempts >= current.maxAttempts
    await tx.authChallenge.update({ where: { id: current.id }, data: { attempts: nextAttempts, ...(locked ? { consumedAt: new Date() } : {}) } })
    return { valid: true, locked }
  })
}

export async function consumePersistentRateLimit(key: string, max: number, windowMs: number) {
  const resetAt = new Date(Date.now() + windowMs)
  const rows = await prisma.$queryRaw<Array<{ allowed: boolean }>>`
    INSERT INTO auth_rate_limits (id, key, count, reset_at, created_at, updated_at)
    VALUES (gen_random_uuid(), ${key}, 1, ${resetAt}, NOW(), NOW())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN auth_rate_limits.reset_at <= NOW() THEN 1
        WHEN auth_rate_limits.count < ${max} THEN auth_rate_limits.count + 1
        ELSE auth_rate_limits.count END,
      reset_at = CASE WHEN auth_rate_limits.reset_at <= NOW() THEN ${resetAt} ELSE auth_rate_limits.reset_at END,
      updated_at = NOW()
    RETURNING (count <= ${max} AND reset_at > NOW()) AS allowed
  `
  return rows[0]?.allowed === true
}
