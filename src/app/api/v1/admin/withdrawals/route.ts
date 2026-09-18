import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { errorResponse, successResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils';
import { getCurrentAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { approveWithdrawal, rejectWithdrawal } from '@/lib/banking';

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorizedResponse();
  if (!hasPermission(admin.role.permissions as string[], 'withdrawals.manage')) return forbiddenResponse();

  const withdrawals = await prisma.withdrawal.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      account: { select: { accountNumber: true, currency: true } },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  return successResponse(withdrawals);
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorizedResponse();
  if (!hasPermission(admin.role.permissions as string[], 'withdrawals.manage')) return forbiddenResponse();

  try {
    const body = await req.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const action = body.action === 'approve' || body.action === 'reject' ? body.action : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : undefined;
    if (!id || !action) return errorResponse('Invalid request', 400);

    const result = action === 'approve'
      ? await approveWithdrawal(admin.id, id, reason)
      : await rejectWithdrawal(admin.id, id, reason);

    return successResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Withdrawal operation failed', 400);
  }
}
