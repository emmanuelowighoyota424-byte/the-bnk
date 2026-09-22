/** Customer registration and login backed by PostgreSQL/Prisma. */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, verifyPassword, validatePasswordStrength } from '@/lib/auth/password-utils'
import { verifyOTP } from '@/lib/auth/otp-service'
import { verifyTOTP } from '@/lib/auth/totp-service'
import { createSession } from '@/lib/auth/session'
import { randomBytes, randomInt } from 'node:crypto'
import { Resend } from 'resend'

function generateAccountNumber(): string {
  return `9${randomInt(100000000, 1000000000)}`
}

function splitName(name: string | undefined) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  return { firstName: parts[0] || 'Customer', lastName: parts.slice(1).join(' ') || 'User' }
}

function serializeUser(user: { id: string; email: string; firstName: string; lastName: string; phone: string | null; status: string }) {
  return {
    id: user.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`.trim(),
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    status: user.status,
  }
}

function routingNumber() {
  const value = process.env.BNK_ROUTING_NUMBER?.trim()
  return value && /^\d{9}$/.test(value) ? value : '000000000'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const action = String(body.action ?? '')
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    const userId = String(body.userId ?? '')
    const otp = String(body.otp ?? '').trim()
    const token = String(body.token ?? '').trim()

    if (!email && ['signup', 'login', 'request-password-reset'].includes(action)) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (action === 'request-password-reset') {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true, firstName: true } })
      const genericResponse = NextResponse.json({ message: 'If an account exists, a reset link will arrive shortly.' })
      if (!user) return genericResponse

      await prisma.transactionVerificationCode.updateMany({
        where: { userId: user.id, type: 'password_reset', usedAt: null },
        data: { usedAt: new Date() },
      })
      const rawToken = randomBytes(32).toString('hex')
      await prisma.transactionVerificationCode.create({
        data: {
          userId: user.id,
          type: 'password_reset',
          codeHash: await hashPassword(rawToken),
          requestHash: await hashPassword(`${user.id}:${Date.now()}`),
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      })

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
      const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(email)}`
      const resendKey = process.env.RESEND_API_KEY
      if (resendKey) {
        const resend = new Resend(resendKey)
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'Crestline Capital <security@resend.dev>',
          to: email,
          subject: 'Reset your Crestline Capital password',
          html: `<p>Hi ${user.firstName},</p><p>Use the secure link below to reset your Crestline Capital password. It expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
        })
      } else {
        console.warn('[Crestline] RESEND_API_KEY is not configured; password reset email was not sent.')
      }
      return genericResponse
    }

    if (action === 'reset-password') {
      if (!email || !token || !password) return NextResponse.json({ error: 'Email, reset token, and new password are required' }, { status: 400 })
      const strength = validatePasswordStrength(password)
      if (!strength.isStrong) return NextResponse.json({ error: strength.errors.join('. ') }, { status: 400 })
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
      const resetCode = await prisma.transactionVerificationCode.findFirst({ where: { userId: user.id, type: 'password_reset', usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } })
      if (!resetCode || !(await verifyPassword(token, resetCode.codeHash))) return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } }),
        prisma.transactionVerificationCode.update({ where: { id: resetCode.id }, data: { usedAt: new Date() } }),
        prisma.userSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } }),
      ])
      return NextResponse.json({ message: 'Password updated. You can now sign in.' })
    }

    if (action === 'signup') {
      const strength = validatePasswordStrength(password)
      if (!strength.isStrong) {
        return NextResponse.json({ error: strength.errors.join('. ') }, { status: 400 })
      }

      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })

      const { firstName, lastName } = splitName(body.name)
      const passwordHash = await hashPassword(password)
      let accountNumber = generateAccountNumber()

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const result = await prisma.$transaction(async (tx: any) => {
            const user = await tx.user.create({
              data: {
                email,
                passwordHash,
                firstName,
                lastName,
                phone: body.phone ? String(body.phone).trim() : null,
              },
            })
            const account = await tx.account.create({
              data: {
                userId: user.id,
                accountType: 'checking',
                accountNumber,
                routingNumber: routingNumber(),
                balance: 0,
                availableBalance: 0,
                currency: 'USD',
                status: 'active',
              },
            })
            await tx.notification.create({
              data: {
                userId: user.id,
                title: 'Welcome to Crestline Capital',
                message: `Your checking account ending in ${accountNumber.slice(-4)} has been created.`,
                type: 'account',
              },
            })
            return { user, account }
          })

          await createSession(result.user.id, request)
          return NextResponse.json({
            message: 'User created successfully',
            userId: result.user.id,
            accountNumber: result.account.accountNumber,
            maskedAccountNumber: `****${result.account.accountNumber.slice(-4)}`,
            authenticated: true,
          }, { status: 201 })
        } catch (error) {
          if ((error as { code?: string }).code !== 'P2002') throw error
          accountNumber = generateAccountNumber()
        }
      }

      return NextResponse.json({ error: 'Unable to allocate a unique account number' }, { status: 503 })
    }

    if (action === 'login') {
      if (!password) return NextResponse.json({ error: 'Password is required' }, { status: 400 })

      const user = await prisma.user.findUnique({ where: { email } })
      if (!user || user.status !== 'active' || !(await verifyPassword(password, user.passwordHash))) {
        return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
      }

      if (user.totpEnabled && user.totpSecret) {
        return NextResponse.json({
          message: 'TOTP verification required',
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`.trim(),
          userEmail: user.email,
          requiresTOTP: true,
          requiresOTP: false,
        })
      }

      await createSession(user.id, request)
      const accounts = await prisma.account.findMany({ where: { userId: user.id }, orderBy: { openedAt: 'asc' } })
      return NextResponse.json({
        message: 'Authentication successful',
        userId: user.id,
        authenticated: true,
        user: serializeUser(user),
        accounts,
        requiresOTP: false,
        requiresTOTP: false,
      })
    }

    if (action === 'verify-otp') {
      if (!userId || !otp) return NextResponse.json({ error: 'User ID and OTP are required' }, { status: 400 })
      if (!(await verifyOTP(userId, otp))) return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 })

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, firstName: true, lastName: true, phone: true, status: true },
      })
      if (!user || user.status !== 'active') return NextResponse.json({ error: 'User not found' }, { status: 401 })

      await createSession(user.id, request)
      const accounts = await prisma.account.findMany({ where: { userId }, orderBy: { openedAt: 'asc' } })
      return NextResponse.json({ message: 'Authentication successful', userId, authenticated: true, user: serializeUser(user), accounts })
    }

    if (action === 'verify-totp') {
      if (!userId || !otp) return NextResponse.json({ error: 'User ID and TOTP are required' }, { status: 400 })

      const user = await prisma.user.findUnique({ where: { id: userId } })
      if (!user || user.status !== 'active' || !user.totpEnabled || !user.totpSecret) {
        return NextResponse.json({ error: 'User not found or 2FA is not configured' }, { status: 401 })
      }
      if (!verifyTOTP(user.totpSecret, otp)) return NextResponse.json({ error: 'Invalid TOTP code' }, { status: 401 })

      await createSession(user.id, request)
      const accounts = await prisma.account.findMany({ where: { userId }, orderBy: { openedAt: 'asc' } })
      return NextResponse.json({ message: 'TOTP verification successful', userId, authenticated: true, user: serializeUser(user), accounts })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('[BNK] Auth error:', error)
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 })
  }
}
