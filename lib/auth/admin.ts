import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

export const ADMIN_COOKIE = 'bnk_admin_session'
const TTL_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const ipOf = (request: Request) => request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null

export function validMasterKeyFormat(key: string) { return /^[0-9a-fA-F]{48}$/.test(key) }

async function verifyMasterKey(input: string) {
  const stored = process.env.ADMIN_MASTER_KEY_HASH?.trim()
  if (!stored || !validMasterKeyFormat(input)) return false
  return bcrypt.compare(input, stored)
}

async function getAdmin() {
  return prisma.adminUser.findFirst({
    where: { status: 'active', role: { name: { in: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'COMPLIANCE', 'SUPPORT'] } } },
    include: { role: true },
    orderBy: { createdAt: 'asc' },
  })
}

export async function authenticateAdmin(request: Request, masterKey: string) {
  const ip = ipOf(request)
  const userAgent = request.headers.get('user-agent')
  const since = new Date(Date.now() - WINDOW_MS)
  const failures = await prisma.adminLoginAttempt.count({ where: { ipAddress: ip, succeeded: false, createdAt: { gte: since } } })
  if (failures >= MAX_ATTEMPTS) return { ok: false as const, status: 429, error: 'Too many attempts. Try again later.' }

  const ok = await verifyMasterKey(masterKey)
  await prisma.adminLoginAttempt.create({ data: { ipAddress: ip, userAgent, succeeded: ok } })
  if (!ok) return { ok: false as const, status: 401, error: 'Invalid master key.' }

  const admin = await getAdmin()
  if (!admin) return { ok: false as const, status: 503, error: 'No active administrator is configured.' }

  const token = randomBytes(32).toString('base64url')
  await prisma.$transaction([
    prisma.adminSession.create({ data: { adminId: admin.id, tokenHash: hash(token), ipAddress: ip, userAgent, expiresAt: new Date(Date.now() + TTL_MS) } }),
    prisma.auditLog.create({ data: { actorId: admin.id, actorType: 'ADMIN', action: 'ADMIN_LOGIN', entityType: 'AdminSession', ipAddress: ip, userAgent } }),
    prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }),
  ])
  cookies().set(ADMIN_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: TTL_MS / 1000 })
  return { ok: true as const, admin: { id: admin.id, email: admin.email, displayName: admin.displayName, role: admin.role.name }, expiresAt: new Date(Date.now() + TTL_MS).toISOString() }
}

export async function getAdminSession() {
  const token = cookies().get(ADMIN_COOKIE)?.value
  if (!token) return null
  return prisma.adminSession.findFirst({ where: { tokenHash: hash(token), revokedAt: null, expiresAt: { gt: new Date() } }, include: { admin: { include: { role: true } } } })
}

export async function requireAdmin() {
  const session = await getAdminSession()
  if (!session || session.admin.status !== 'active') return null
  return session.admin
}

export async function revokeAdminSession() {
  const token = cookies().get(ADMIN_COOKIE)?.value
  if (token) await prisma.adminSession.updateMany({ where: { tokenHash: hash(token), revokedAt: null }, data: { revokedAt: new Date() } })
  cookies().set(ADMIN_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 })
}
