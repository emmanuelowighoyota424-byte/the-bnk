import { NextRequest } from 'next/server';
import prisma from '../../../../../lib/prisma';
import { errorResponse, successResponse, unauthorizedResponse } from '../../../../../lib/api-utils';
import { getCurrentUser } from '../../../../../lib/auth';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();

    const account = await prisma.account.findFirst({
      where: { id: params.id, userId: user.id },
      select: {
        id: true,
        accountType: true,
        accountNumber: true,
        routingNumber: true,
        balance: true,
        availableBalance: true,
        currency: true,
        status: true,
        interestRate: true,
        openedAt: true,
        closedAt: true,
        transactions: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });

    if (!account) return errorResponse('Account not found', 404);
    return successResponse(account);
  } catch (error) {
    console.error(error);
    return errorResponse('Internal server error', 500);
  }
}
