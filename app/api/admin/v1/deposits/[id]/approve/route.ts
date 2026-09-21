import { NextResponse } from 'next/server'
import { requireAdminCapability } from '@/lib/auth/admin-rbac'
import { FEATURE_FLAGS, requireFeature } from '@/lib/config/features'
import { prisma } from '@/lib/prisma'
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdminCapability('deposits')
  if (!admin) return NextResponse.json({ code: 'UNAUTHORIZED', error: 'Unauthorized' }, { status: 401 })
  try { requireFeature(FEATURE_FLAGS.deposits, 'deposits') } catch { return NextResponse.json({ code: 'FEATURE_DISABLED', error: 'Deposits are disabled pending regulatory clearance.' }, { status: 403 }) }
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null
  const userAgent = request.headers.get('user-agent')
  try {
    const result = await prisma.$transaction(async tx => {
      const d = await tx.deposit.findUnique({ where: { id: params.id } })
      if (!d || d.status !== 'pending') throw new Error('INVALID_DEPOSIT')
      await tx.$queryRawUnsafe('SELECT id FROM accounts WHERE id = $1 FOR UPDATE', d.accountId)
      const a = await tx.account.findUnique({ where: { id: d.accountId } })
      if (!a) throw new Error('ACCOUNT_NOT_FOUND')
      const next = a.balance.add(d.amount), availableNext = a.availableBalance.add(d.amount)
      const updated = await tx.deposit.update({ where: { id: d.id }, data: { status: 'approved', completedAt: new Date() } })
      await tx.account.update({ where: { id: a.id }, data: { balance: next, availableBalance: availableNext } })
      await tx.transaction.create({ data: { accountId: a.id, userId: d.userId, txType: 'deposit', amount: d.amount, currency: d.currency, description: d.description || 'Admin-approved deposit', status: 'completed', runningBalance: next, referenceId: d.reference, settledAt: new Date() } })
      await tx.auditLog.create({ data: { actorId: admin.id, actorType: 'ADMIN', action: 'DEPOSIT_APPROVED', entityType: 'Deposit', entityId: d.id, ipAddress, userAgent, changes: { before: { status: d.status, balance: a.balance.toString(), availableBalance: a.availableBalance.toString() }, after: { status: 'approved', balance: next.toString(), availableBalance: availableNext.toString() } } } })
      return updated
    })
    return NextResponse.json({ deposit: result })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    return NextResponse.json({ code: code === 'INVALID_DEPOSIT' ? 'INVALID_STATE' : 'DEPOSIT_APPROVAL_FAILED', error: code === 'INVALID_DEPOSIT' ? 'Deposit is not pending.' : 'Deposit approval failed.' }, { status: 400 })
  }
}
