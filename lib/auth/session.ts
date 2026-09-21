import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

const COOKIE_NAME = 'bnk_session'
const SESSION_DAYS = 7

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId: string, request?: Request) {
  const token = randomBytes(32).toString('base64url')
  const ip = request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const userAgent = request?.headers.get('user-agent') || null
  await prisma.userSession.create({
    data: {
      userId,
      refreshTokenHash: hashToken(token),
      ipAddress: ip,
      deviceInfo: userAgent ? { userAgent } : undefined,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
    },
  })
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export async function getCurrentUserId() {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null
  const session = await prisma.userSession.findFirst({
    where: { refreshTokenHash: hashToken(token), revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userId: true },
  })
  return session?.userId ?? null
}

export async function getCurrentUser() {
  const userId = await getCurrentUserId()
  if (!userId) return null
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, status: true },
  })
}

export async function destroyCurrentSession() {
  const token = cookies().get(COOKIE_NAME)?.value
  if (token) {
    await prisma.userSession.updateMany({
      where: { refreshTokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
  cookies().set(COOKIE_NAME, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 })
}
