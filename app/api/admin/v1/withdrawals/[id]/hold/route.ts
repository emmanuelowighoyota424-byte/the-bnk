import { NextResponse } from 'next/server'
import { requireAdminCapability } from '@/lib/auth/admin-rbac'
import { FEATURE_FLAGS, requireFeature } from '@/lib/config/features'
import { prisma } from '@/lib/prisma'
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const admin = await requireAdminCapability('withdrawals')
  if (!admin) return NextResponse.json({ code: 'UNAUTHORIZED', error: 'Unauthorized' }, { status: 401 })
  try { requireFeature(FEATURE_FLAGS.withdrawals, 'withdrawals') } catch { return NextResponse.json({ code: 'FEATURE_DISABLED', error: 'Withdrawals are disabled pending regulatory clearance.' }, { status: 403 }) }
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null
  const userAgent = request.headers.get('user-agent')
  try {
    const result = await prisma.$transaction(async tx => {
      const w = await tx.withdrawal.findUnique({ where: { id: params.id } })
      if (!w || w.status !== 'pending') throw new Error('INVALID_STATE')
      const updated = await tx.withdrawal.update({ where: { id: w.id }, data: { status: 'held', reviewedAt: new Date(), reviewedBy: admin.id } })
      await tx.auditLog.create({ data: { actorId: admin.id, actorType: 'ADMIN', action: 'WITHDRAWAL_HELD', entityType: 'Withdrawal', entityId: w.id, ipAddress, userAgent, changes: { before: { status: w.status }, after: { status: 'held' } } } })
      return updated
    })
    return NextResponse.json({ withdrawal: result })
  } catch { return NextResponse.json({ code: 'WITHDRAWAL_HOLD_FAILED', error: 'Withdrawal hold failed.' }, { status: 400 }) }
}
