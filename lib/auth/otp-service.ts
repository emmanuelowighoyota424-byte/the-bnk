/** Persistent OTP service backed by PostgreSQL/Prisma. */

import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { generateOTP } from './password-utils'

const hashCode = (code: string) => createHash('sha256').update(code).digest('hex')

export async function generateAndStoreOTP(
  userId: string,
  expiryMinutes = 5,
  maxAttempts = 3,
  type = 'login'
): Promise<string> {
  const code = generateOTP(6)
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)

  await prisma.$transaction(async (tx) => {
    await tx.transactionVerificationCode.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    })

    await tx.transactionVerificationCode.create({
      data: {
        userId,
        type,
        codeHash: hashCode(code),
        requestHash: hashCode(`${userId}:${type}:${expiresAt.getTime()}`),
        attempts: 0,
        expiresAt,
      },
    })
  })

  return code
}

export async function verifyOTP(userId: string, code: string, type = 'login'): Promise<boolean> {
  const record = await prisma.transactionVerificationCode.findFirst({
    where: { userId, type, usedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  if (!record || record.expiresAt <= new Date() || record.attempts >= 3) return false

  const valid = record.codeHash === hashCode(String(code).trim())

  if (!valid) {
    await prisma.transactionVerificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    })
    return false
  }

  await prisma.transactionVerificationCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  })

  return true
}

export async function getOTPAttempts(userId: string, type = 'login') {
  const record = await prisma.transactionVerificationCode.findFirst({
    where: { userId, type, usedAt: null },
    orderBy: { createdAt: 'desc' },
  })

  if (!record || record.expiresAt <= new Date()) return { remaining: 0, total: 3 }
  return { remaining: Math.max(0, 3 - record.attempts), total: 3 }
}

export async function clearOTPSession(userId: string, type = 'login') {
  await prisma.transactionVerificationCode.updateMany({
    where: { userId, type, usedAt: null },
    data: { usedAt: new Date() },
  })
}
