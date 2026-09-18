import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { errorResponse, successResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils';
import { getCurrentAdmin, logAudit } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorizedResponse();
  if (!hasPermission(admin.role.permissions as string[], 'deposits.manage')) return forbiddenResponse();
  const deposits = await prisma.deposit.findMany({
    orderBy: { createdAt: 'desc' }, take: 100,
    include: { account: { select: { accountNumber: true, currency: true } }, user: { select: { id: true, firstName: true, lastName: true, email: true } } }
  });
  return successResponse(deposits);
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorizedResponse();
  if (!hasPermission(admin.role.permissions as string[], 'deposits.manage')) return forbiddenResponse();
  try {
    const body = await req.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const action = body.action === 'approve' || body.action === 'reject' ? body.action : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : undefined;
    if (!id || !action) return errorResponse('Invalid request', 400);
    const result = await prisma.$transaction(async tx => {
      const deposit = await tx.deposit.findUnique({ where: { id } });
      if (!deposit) throw new Error('Deposit not found');
      if (deposit.status !== 'pending') throw new Error('Deposit is no longer pending');
      if (action === 'reject') {
        const updated = await tx.deposit.update({ where: { id }, data: { status: 'rejected' } });
        await tx.notification.create({ data: { userId: deposit.userId, type: 'DEPOSIT_REJECTED', title: 'Deposit rejected', message: reason ? `Your deposit was rejected: ${reason}` : 'Your deposit request was rejected.' } });
        return updated;
      }
      const account = await tx.account.findUnique({ where: { id: deposit.accountId } });
      if (!account || account.status !== 'active') throw new Error('Account is not active');
      const updatedAccount = await tx.account.update({ where: { id: account.id }, data: { balance: { increment: deposit.amount }, availableBalance: { increment: deposit.amount } } });
      const tr = await tx.transaction.create({ data: { accountId: account.id, userId: deposit.userId, txType: 'DEPOSIT', amount: deposit.amount, currency: deposit.currency, description: deposit.description || 'Deposit', status: 'completed', referenceId: deposit.reference, settledAt: new Date(), runningBalance: updatedAccount.balance } });
      await tx.ledgerEntry.create({ data: { transactionId: tr.id, accountId: account.id, direction: 'CREDIT', amount: deposit.amount, currency: deposit.currency } });
      await tx.notification.create({ data: { userId: deposit.userId, type: 'DEPOSIT_COMPLETED', title: 'Deposit completed', message: `Your $${deposit.amount.toFixed(2)} deposit was approved.` } });
      return tx.deposit.update({ where: { id }, data: { status: 'completed', completedAt: new Date() } });
    });
    await logAudit({ actorId: admin.id, actorType: 'admin', action: `deposit.${action}`, entityType: 'deposit', entityId: id, changes: reason ? { reason } : undefined });
    return successResponse(result);
  } catch (e) { return errorResponse(e instanceof Error ? e.message : 'Deposit operation failed', 400); }
}
