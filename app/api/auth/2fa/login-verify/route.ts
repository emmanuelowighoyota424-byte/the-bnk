import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyTOTP } from '@/lib/auth/totp-service'
import { createSession } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  try {
    const { userId, code } = await request.json()

    if (!userId || !code) {
      return NextResponse.json({ error: 'User ID and verification code are required' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        totpSecret: true,
        totpEnabled: true,
      },
    })

    if (!user || user.status !== 'active' || !user.totpEnabled || !user.totpSecret) {
      return NextResponse.json({ error: 'User not found or 2FA not enabled' }, { status: 401 })
    }

    if (!verifyTOTP(user.totpSecret, String(code).trim())) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 401 })
    }

    const accounts = await prisma.account.findMany({
      where: { userId: user.id },
      orderBy: { openedAt: 'asc' },
    })

    await createSession(user.id, request)

    return NextResponse.json({
      success: true,
      message: '2FA verification successful',
      userId: user.id,
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`.trim(),
        phone: user.phone,
      },
      accounts,
    })
  } catch (error) {
    console.error('[BNK] Login 2FA verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
