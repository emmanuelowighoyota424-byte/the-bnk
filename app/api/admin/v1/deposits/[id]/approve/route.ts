import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { FEATURE_FLAGS, requireFeature } from '@/lib/config/features'
import { prisma } from '@/lib/prisma'

export async function POST(_r: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { requireFeature(FEATURE_FLAGS.deposits, 'deposits') } catch { return NextResponse.json({ code: 'FEATURE_DISABLED', error: 'Deposits are disabled pending regulatory clearance.' }, { status: 403 }) }
  try {
    const result = await prisma.$transaction(async tx => {
      const d = await tx.deposit.findUnique({ where: { id: params.id } })
      if (!d || d.status !== 'pending') throw new Error('INVALID_DEPOSIT')
      const a = await tx.account.findUnique({ where: { id: d.accountId } })
      if (!a) throw new Error('ACCOUNT_NOT_FOUND')
      const next = Number(a.balance) + Number(d.amount)
      await tx.account.update({ where: { id: a.id }, data: { balance: next, availableBalance: next } })
      const updated = await tx.deposit.update({ where: { id: d.id }, data: { status: 'approved', completedAt: new Date() } })
      await tx.transaction.create({ data: { accountId: a.id, userId: d.userId, txType: 'deposit', amount: d.amount, currency: d.currency, description: d.description || 'Admin-approved deposit', status: 'completed', runningBalance: next, referenceId: d.reference, settledAt: new Date() } })
      await tx.auditLog.create({ data: { actorId: admin.id, actorType: 'ADMIN', action: 'DEPOSIT_APPROVED', entityType: 'Deposit', entityId: d.id, changes: { before: { status: d.status }, after: { status: 'approved' } } } })
      return updated
    })
    return NextResponse.json({ deposit: result })
  } catch (e) { return NextResponse.json({ error: e instanceof Error && e.message === 'INVALID_DEPOSIT' ? 'Deposit is not pending' : 'Deposit approval failed' }, { status: 400 }) }
}
