/** Persistent OTP service backed by PostgreSQL/Prisma. */

import { createHash, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { generateOTP } from './password-utils'

const hashCode = (code: string) => createHash('sha256').update(code).digest('hex')
const MAX_ATTEMPTS = 3

export async function generateAndStoreOTP(userId: string, expiryMinutes = 5, maxAttempts = MAX_ATTEMPTS, type = 'login'): Promise<string> {
  const code = generateOTP(6)
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000)
  const requestHash = hashCode(`${userId}:${type}:${expiresAt.getTime()}`)

  await prisma.$transaction(async (tx) => {
    await tx.transactionVerificationCode.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    })
    await tx.transactionVerificationCode.create({
      data: { userId, type, codeHash: hashCode(code), requestHash, attempts: 0, expiresAt },
    })
  })
  return code
}

export async function verifyOTP(userId: string, code: string, type = 'login'): Promise<boolean> {
  const record = await prisma.transactionVerificationCode.findFirst({
    where: { userId, type, usedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  if (!record || record.expiresAt <= new Date() || record.attempts >= MAX_ATTEMPTS) return false

  const expected = Buffer.from(record.codeHash, 'hex')
  const actual = Buffer.from(hashCode(String(code).trim()), 'hex')
  const valid = expected.length === actual.length && timingSafeEqual(expected, actual)

  if (!valid) {
    const attempts = record.attempts + 1
    await prisma.transactionVerificationCode.update({ where: { id: record.id }, data: { attempts } })
    if (attempts >= MAX_ATTEMPTS) {
      await prisma.transactionVerificationCode.update({ where: { id: record.id }, data: { usedAt: new Date() } })
    }
    return false
  }

  await prisma.transactionVerificationCode.update({ where: { id: record.id }, data: { usedAt: new Date() } })
  return true
}

export async function getOTPAttempts(userId: string, type = 'login') {
  const record = await prisma.transactionVerificationCode.findFirst({ where: { userId, type, usedAt: null }, orderBy: { createdAt: 'desc' } })
  if (!record || record.expiresAt <= new Date()) return { remaining: 0, total: MAX_ATTEMPTS }
  return { remaining: Math.max(0, MAX_ATTEMPTS - record.attempts), total: MAX_ATTEMPTS }
}

export async function clearOTPSession(userId: string, type = 'login') {
  await prisma.transactionVerificationCode.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } })
}
