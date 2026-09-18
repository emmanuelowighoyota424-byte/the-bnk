import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils';
import { getCurrentUser } from '@/lib/auth';

export async function GET(_request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    const accounts = await prisma.account.findMany({
      where: { userId: user.id, status: { not: 'closed' } },
      select: { id: true, accountType: true, accountNumber: true, balance: true, availableBalance: true, currency: true, status: true, interestRate: true, openedAt: true },
      orderBy: { openedAt: 'desc' },
    });
    return successResponse(accounts);
  } catch (e) {
    console.error(e);
    return errorResponse('Internal server error', 500);
  }
}
