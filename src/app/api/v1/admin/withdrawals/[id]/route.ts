import { NextRequest } from 'next/server';
import { errorResponse, successResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils';
import { getCurrentAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { approveWithdrawal, rejectWithdrawal } from '@/lib/banking';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorizedResponse();
  if (!hasPermission(admin.role.permissions as string[], 'withdrawals.manage')) return forbiddenResponse();

  try {
    const body = await req.json();
    const action = body.action === 'reject' ? 'reject' : body.action === 'approve' ? 'approve' : null;
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : undefined;
    if (!action) return errorResponse('Invalid action', 400);

    const result = action === 'approve'
      ? await approveWithdrawal(admin.id, params.id, reason)
      : await rejectWithdrawal(admin.id, params.id, reason);

    return successResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Withdrawal operation failed', 400);
  }
}
