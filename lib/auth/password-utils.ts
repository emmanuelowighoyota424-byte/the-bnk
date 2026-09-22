/** Canonical password and authentication-secret utilities. */
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'

const BCRYPT_ROUNDS = 12
const PBKDF2_LEGACY_ITERATIONS = 1000

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    if (/^\$2[aby]\$\d{2}\$/.test(encoded)) return bcrypt.compare(password, encoded)
    const parts = encoded.split('$')
    if (parts.length === 4 && parts[0] === 'pbkdf2_sha256') {
      const iterations = Number(parts[1])
      if (!Number.isSafeInteger(iterations) || iterations < 1000 || iterations > 10000000) return false
      const salt = Buffer.from(parts[2], 'hex')
      const expected = Buffer.from(parts[3], 'hex')
      const actual = crypto.pbkdf2Sync(password, salt, iterations, expected.length, 'sha256')
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
    }
    const [salt, storedHash] = encoded.split('.')
    if (!salt || !storedHash || !/^[a-f0-9]{64}$/i.test(storedHash)) return false
    const actual = crypto.pbkdf2Sync(password, salt, PBKDF2_LEGACY_ITERATIONS, 32, 'sha256')
    const expected = Buffer.from(storedHash, 'hex')
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
  } catch { return false }
}

export async function verifyAndUpgradePassword(password: string, encoded: string) {
  const valid = await verifyPassword(password, encoded)
  if (!valid) return { valid: false as const }
  if (/^\$2[aby]\$\d{2}\$/.test(encoded)) return { valid: true as const }
  return { valid: true as const, upgradedHash: await hashPassword(password) }
}

export function validatePasswordStrength(password: string): { isStrong: boolean; errors: string[] } {
  const errors: string[] = []
  if (password.length < 12) errors.push('Password must be at least 12 characters long')
  if (password.length > 128) errors.push('Password must be at most 128 characters long')
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter')
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter')
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number')
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password must contain at least one special character')
  return { isStrong: errors.length === 0, errors }
}

export function generateOTP(length = 6): string {
  if (!Number.isInteger(length) || length < 4 || length > 10) throw new Error('Invalid OTP length')
  return Array.from({ length }, () => crypto.randomInt(0, 10)).join('')
}

export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex')
}

export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase()
    return `${code.slice(0, 4)}-${code.slice(4)}`
  })
}
