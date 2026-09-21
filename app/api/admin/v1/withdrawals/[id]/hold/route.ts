import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { FEATURE_FLAGS, requireFeature } from '@/lib/config/features'
import { prisma } from '@/lib/prisma'

export async function POST(_r: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { requireFeature(FEATURE_FLAGS.withdrawals, 'withdrawals') } catch { return NextResponse.json({ code: 'FEATURE_DISABLED', error: 'Withdrawals are disabled pending regulatory clearance.' }, { status: 403 }) }
  const w = await prisma.withdrawal.findUnique({ where: { id: params.id } })
  if (!w || w.status !== 'pending') return NextResponse.json({ error: 'Withdrawal is not pending' }, { status: 400 })
  const updated = await prisma.withdrawal.update({ where: { id: w.id }, data: { status: 'held', reviewedAt: new Date(), reviewedBy: admin.id } })
  await prisma.auditLog.create({ data: { actorId: admin.id, actorType: 'ADMIN', action: 'WITHDRAWAL_HELD', entityType: 'Withdrawal', entityId: w.id, changes: { before: { status: w.status }, after: { status: 'held' } } } })
  return NextResponse.json({ withdrawal: updated })
}
