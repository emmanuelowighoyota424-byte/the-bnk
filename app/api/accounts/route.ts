import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/auth/session'

export async function GET() {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const accounts = await prisma.account.findMany({
      where: { userId, status: { not: 'closed' } },
      orderBy: { openedAt: 'desc' },
      select: { id: true, accountType: true, accountNumber: true, routingNumber: true, balance: true, availableBalance: true, currency: true, status: true, interestRate: true, openedAt: true },
    })
    return NextResponse.json({
      accounts,
      totalBalance: accounts.reduce((sum: number, account: { balance: unknown }) => sum + Number(account.balance), 0),
      count: accounts.length,
      lastSync: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[BNK] Accounts fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const accountType = String(body.type || 'checking').trim().toLowerCase()
    if (!['checking', 'savings'].includes(accountType)) return NextResponse.json({ error: 'Invalid account type' }, { status: 400 })

    const { randomInt } = await import('node:crypto')
    let accountNumber = ''
    for (let attempt = 0; attempt < 8; attempt++) {
      accountNumber = Array.from({ length: 12 }, () => randomInt(0, 10)).join('')
      if (!(await prisma.account.findUnique({ where: { accountNumber }, select: { id: true } }))) break
      accountNumber = ''
    }
    if (!accountNumber) return NextResponse.json({ error: 'Unable to generate account number' }, { status: 503 })

    const account = await prisma.account.create({
      data: { userId, accountType, accountNumber, currency: 'USD', balance: 0, availableBalance: 0, status: 'active' },
    })
    return NextResponse.json({ message: 'Account created successfully', account }, { status: 201 })
  } catch (error) {
    console.error('[BNK] Account creation error:', error)
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 })
  }
}
