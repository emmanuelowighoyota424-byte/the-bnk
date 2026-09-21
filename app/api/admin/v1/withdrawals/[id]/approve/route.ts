import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { FEATURE_FLAGS, requireFeature } from '@/lib/config/features'
import { prisma } from '@/lib/prisma'
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ code: 'UNAUTHORIZED', error: 'Unauthorized' }, { status: 401 })
  try { requireFeature(FEATURE_FLAGS.withdrawals, 'withdrawals') } catch { return NextResponse.json({ code: 'FEATURE_DISABLED', error: 'Withdrawals are disabled pending regulatory clearance.' }, { status: 403 }) }
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null
  const userAgent = request.headers.get('user-agent')
  try {
    const result = await prisma.$transaction(async tx => {
      const w = await tx.withdrawal.findUnique({ where: { id: params.id } })
      if (!w || (w.status !== 'pending' && w.status !== 'held')) throw new Error('INVALID_WITHDRAWAL')
      await tx.$queryRawUnsafe('SELECT id FROM accounts WHERE id = $1 FOR UPDATE', w.accountId)
      const a = await tx.account.findUnique({ where: { id: w.accountId } })
      if (!a) throw new Error('ACCOUNT_NOT_FOUND')
      if (a.availableBalance.lt(w.amount)) throw new Error('INSUFFICIENT_FUNDS')
      const next = a.balance.sub(w.amount), availableNext = a.availableBalance.sub(w.amount)
      const updated = await tx.withdrawal.update({ where: { id: w.id }, data: { status: 'approved', reviewedAt: new Date(), reviewedBy: admin.id } })
      await tx.account.update({ where: { id: a.id }, data: { balance: next, availableBalance: availableNext } })
      await tx.transaction.create({ data: { accountId: a.id, userId: w.userId, txType: 'withdrawal', amount: w.amount, currency: w.currency, description: w.description || 'Admin-approved withdrawal', status: 'completed', runningBalance: next, referenceId: w.reference, settledAt: new Date() } })
      await tx.auditLog.create({ data: { actorId: admin.id, actorType: 'ADMIN', action: 'WITHDRAWAL_APPROVED', entityType: 'Withdrawal', entityId: w.id, ipAddress, userAgent, changes: { before: { status: w.status, balance: a.balance.toString(), availableBalance: a.availableBalance.toString() }, after: { status: 'approved', balance: next.toString(), availableBalance: availableNext.toString() } } } })
      return updated
    })
    return NextResponse.json({ withdrawal: result })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    const message = code === 'INVALID_WITHDRAWAL' ? 'Withdrawal is not pending or held.' : code === 'INSUFFICIENT_FUNDS' ? 'Insufficient available balance.' : 'Withdrawal approval failed.'
    return NextResponse.json({ code: code || 'WITHDRAWAL_APPROVAL_FAILED', error: message }, { status: 400 })
  }
}
