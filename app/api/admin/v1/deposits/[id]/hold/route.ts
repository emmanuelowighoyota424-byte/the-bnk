import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { FEATURE_FLAGS, requireFeature } from '@/lib/config/features'
import { prisma } from '@/lib/prisma'

export async function POST(_r: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try { requireFeature(FEATURE_FLAGS.deposits, 'deposits') } catch { return NextResponse.json({ code: 'FEATURE_DISABLED', error: 'Deposits are disabled pending regulatory clearance.' }, { status: 403 }) }
  const d = await prisma.deposit.findUnique({ where: { id: params.id } })
  if (!d || d.status !== 'pending') return NextResponse.json({ error: 'Deposit is not pending' }, { status: 400 })
  const updated = await prisma.deposit.update({ where: { id: d.id }, data: { status: 'held' } })
  await prisma.auditLog.create({ data: { actorId: admin.id, actorType: 'ADMIN', action: 'DEPOSIT_HELD', entityType: 'Deposit', entityId: d.id, changes: { before: { status: d.status }, after: { status: 'held' } } } })
  return NextResponse.json({ deposit: updated })
}
