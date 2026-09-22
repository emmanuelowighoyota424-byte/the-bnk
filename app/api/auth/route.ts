import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyAndUpgradePassword, validatePasswordStrength, hashSecret } from '@/lib/auth/password-utils'
import { createAuthChallenge, getChallenge, consumeChallenge, recordChallengeFailure, consumePersistentRateLimit } from '@/lib/auth/challenge'
import { createAuthenticatedSession } from '@/lib/auth'
import { generateAccountNumber } from '@/lib/account-number'
import speakeasy from 'speakeasy'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = String(body.action || '')
    const email = String(body.email || '').trim().toLowerCase()
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const ua = request.headers.get('user-agent') || undefined

    if (action === 'login') {
      const password = String(body.password || '')
      if (!email || !password) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      if (!(await consumePersistentRateLimit(`login:${ip}`, 10, 900000))) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user || user.status !== 'active') return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      const result = await verifyAndUpgradePassword(password, user.passwordHash)
      if (!result.valid) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      if (result.upgradedHash) await prisma.user.update({ where: { id: user.id }, data: { passwordHash: result.upgradedHash } })
      if (user.totpEnabled && user.totpSecret) {
        const challenge = await createAuthChallenge({ userId: user.id, purpose: 'LOGIN_2FA', type: 'TOTP', ipAddress: ip, userAgent: ua })
        return NextResponse.json({ requiresTOTP: true, challengeId: challenge.id, expiresAt: challenge.expiresAt })
      }
      await createAuthenticatedSession(user.id, user.email, ip, ua)
      return NextResponse.json({ authenticated: true, userId: user.id })
    }

    if (action === 'verify-totp') {
      const challenge = await getChallenge(String(body.challengeId || ''), 'LOGIN_2FA')
      const code = String(body.otp || body.token || '').trim()
      if (!challenge || challenge.type !== 'TOTP') return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 401 })
      const user = await prisma.user.findUnique({ where: { id: challenge.userId } })
      if (!user || user.status !== 'active' || !user.totpEnabled || !user.totpSecret) return NextResponse.json({ error: 'Invalid authentication challenge' }, { status: 401 })
      if (!/^\d{6}$/.test(code) || !speakeasy.totp.verify({ secret: user.totpSecret, encoding: 'base32', token: code, window: 1 })) {
        await recordChallengeFailure(challenge.id, 'LOGIN_2FA', user.id)
        return NextResponse.json({ error: 'Invalid code' }, { status: 401 })
      }
      if (!(await consumeChallenge(challenge.id, 'LOGIN_2FA', user.id))) return NextResponse.json({ error: 'Challenge already used' }, { status: 401 })
      await createAuthenticatedSession(user.id, user.email, ip, ua)
      return NextResponse.json({ authenticated: true, userId: user.id })
    }

    if (action === 'verify-otp') {
      const challenge = await getChallenge(String(body.challengeId || ''), 'LOGIN_2FA')
      const code = String(body.otp || '').trim()
      if (!challenge || challenge.type !== 'OTP' || hashSecret(code) !== challenge.challengeHash) return NextResponse.json({ error: 'Invalid or expired challenge' }, { status: 401 })
      if (!(await consumeChallenge(challenge.id, 'LOGIN_2FA', challenge.userId))) return NextResponse.json({ error: 'Challenge already used' }, { status: 401 })
      const user = await prisma.user.findUnique({ where: { id: challenge.userId } })
      if (!user || user.status !== 'active') return NextResponse.json({ error: 'Invalid authentication challenge' }, { status: 401 })
      await createAuthenticatedSession(user.id, user.email, ip, ua)
      return NextResponse.json({ authenticated: true, userId: user.id })
    }

    if (action === 'signup') {
      const password = String(body.password || '')
      const strength = validatePasswordStrength(password)
      const firstName = String(body.firstName || body.name || '').trim().split(/\s+/)[0]
      const lastName = String(body.lastName || '').trim() || String(body.name || '').trim().split(/\s+/).slice(1).join(' ')
      if (!email || !firstName || !lastName || !strength.isStrong) return NextResponse.json({ error: 'Invalid registration details' }, { status: 400 })
      const user = await prisma.$transaction(async tx => {
        const created = await tx.user.create({ data: { email, passwordHash: await hashPassword(password), firstName, lastName, phone: body.phone ? String(body.phone).trim() : null } })
        await tx.account.create({ data: { userId: created.id, accountType: 'checking', accountNumber: generateAccountNumber(), currency: 'USD', balance: 0, availableBalance: 0, status: 'active' } })
        return created
      })
      await createAuthenticatedSession(user.id, user.email, ip, ua)
      return NextResponse.json({ authenticated: true, userId: user.id }, { status: 201 })
    }

    if (action === 'reset-password') {
      const challenge = await getChallenge(String(body.challengeId || ''), 'PASSWORD_RESET')
      const password = String(body.password || '')
      if (!challenge || challenge.challengeHash !== hashSecret(String(body.token || '')) || !validatePasswordStrength(password).isStrong) return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
      await prisma.$transaction(async tx => {
        await tx.user.update({ where: { id: challenge.userId }, data: { passwordHash: await hashPassword(password) } })
        await tx.authChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } })
        await tx.userSession.updateMany({ where: { userId: challenge.userId, revokedAt: null }, data: { revokedAt: new Date() } })
      })
      return NextResponse.json({ message: 'Password updated. You can now sign in.' })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[BNK] Auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
