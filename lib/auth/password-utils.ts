/** Password and one-time-code utilities for server-side authentication. */

import crypto from 'node:crypto'

const PBKDF2_ITERATIONS = 210_000
const KEY_LENGTH = 32
const DIGEST = 'sha256'

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16)
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST)
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${salt.toString('hex')}$${hash.toString('hex')}`
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const parts = encoded.split('$')
    if (parts.length === 4 && parts[0] === 'pbkdf2_sha256') {
      const iterations = Number(parts[1])
      const salt = Buffer.from(parts[2], 'hex')
      const expected = Buffer.from(parts[3], 'hex')
      const actual = crypto.pbkdf2Sync(password, salt, iterations, expected.length, DIGEST)
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
    }

    // Backward-compatible verification for existing BNK password records.
    const [salt, storedHash] = encoded.split('.')
    if (!salt || !storedHash) return false
    const actual = crypto.pbkdf2Sync(password, salt, 1000, 32, DIGEST).toString('hex')
    return crypto.timingSafeEqual(Buffer.from(storedHash, 'hex'), Buffer.from(actual, 'hex'))
  } catch {
    return false
  }
}

export function validatePasswordStrength(password: string): { isStrong: boolean; errors: string[] } {
  const errors: string[] = []
  if (password.length < 8) errors.push('Password must be at least 8 characters long')
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter')
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter')
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number')
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password must contain at least one special character')
  return { isStrong: errors.length === 0, errors }
}

export function generateOTP(length = 6): string {
  if (!Number.isInteger(length) || length < 4 || length > 10) throw new Error('Invalid OTP length')
  let result = ''
  for (let i = 0; i < length; i++) result += crypto.randomInt(0, 10).toString()
  return result
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase()
    return `${code.slice(0, 4)}-${code.slice(4)}`
  })
}
