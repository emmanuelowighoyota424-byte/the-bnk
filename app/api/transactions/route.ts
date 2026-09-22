import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUserId } from '@/lib/auth/session'

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const accountId = request.nextUrl.searchParams.get('accountId')
    const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get('days') || 30), 1), 365)
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const transactions = await prisma.transaction.findMany({
      where: { userId, ...(accountId ? { accountId } : {}), createdAt: { gte: fromDate } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { id: true, accountId: true, txType: true, amount: true, currency: true, description: true, merchantName: true, merchantCategory: true, category: true, status: true, runningBalance: true, referenceId: true, createdAt: true, settledAt: true },
    })
    const spendingByCategory: Record<string, number> = {}
    for (const tx of transactions) {
      if (['debit', 'withdrawal', 'transfer', 'bill_payment'].includes(tx.txType)) {
        const category = tx.category || 'uncategorized'
        spendingByCategory[category] = (spendingByCategory[category] || 0) + Number(tx.amount)
      }
    }
    return NextResponse.json({ transactions, count: transactions.length, period: `Last ${days} days`, spendingByCategory, lastSync: new Date().toISOString() })
  } catch (error) {
    console.error('[BNK] Transactions fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json()
    const accountId = String(body.accountId || '')
    const amount = Number(body.amount)
    const txType = String(body.type || body.txType || '').trim().toLowerCase()
    if (!accountId || !Number.isFinite(amount) || amount <= 0 || !txType) return NextResponse.json({ error: 'Account, amount, and transaction type are required' }, { status: 400 })
    if (!['credit', 'debit', 'deposit', 'withdrawal'].includes(txType)) return NextResponse.json({ error: 'Unsupported transaction type' }, { status: 400 })

    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.account.findFirst({ where: { id: accountId, userId, status: 'active' } })
      if (!account) throw new Error('ACCOUNT_NOT_FOUND')
      const credit = txType === 'credit' || txType === 'deposit'
      const nextBalance = Number(account.balance) + (credit ? amount : -amount)
      if (nextBalance < 0) throw new Error('INSUFFICIENT_FUNDS')
      const updated = await tx.account.update({ where: { id: account.id }, data: { balance: nextBalance, availableBalance: nextBalance } })
      const transaction = await tx.transaction.create({
        data: {
          accountId: account.id,
          userId,
          txType,
          amount,
          currency: account.currency,
          description: body.description ? String(body.description) : null,
          category: body.category ? String(body.category) : null,
          status: 'completed',
          runningBalance: nextBalance,
          referenceId: body.referenceId ? String(body.referenceId) : null,
          settledAt: new Date(),
        },
      })
      return { transaction, account: updated }
    })
    return NextResponse.json({ message: 'Transaction created successfully', transaction: result.transaction, account: result.account }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message === 'ACCOUNT_NOT_FOUND') return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    if (error instanceof Error && error.message === 'INSUFFICIENT_FUNDS') return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 })
    console.error('[BNK] Transaction creation error:', error)
    return NextResponse.json({ error: 'Failed to create transaction' }, { status: 500 })
  }
}
