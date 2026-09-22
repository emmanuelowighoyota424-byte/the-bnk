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
      if (!d || d.status !== 'pending') throw new Error('INVALID_STATE')
      const updated = await tx.deposit.update({ where: { id: d.id }, data: { status: 'held' } })
      await tx.auditLog.create({ data: { actorId: admin.id, actorType: 'ADMIN', action: 'DEPOSIT_HELD', entityType: 'Deposit', entityId: d.id, ipAddress, userAgent, changes: { before: { status: d.status }, after: { status: 'held' } } } })
      return updated
    })
    return NextResponse.json({ deposit: result })
  } catch { return NextResponse.json({ code: 'DEPOSIT_HOLD_FAILED', error: 'Deposit hold failed.' }, { status: 400 }) }
}
