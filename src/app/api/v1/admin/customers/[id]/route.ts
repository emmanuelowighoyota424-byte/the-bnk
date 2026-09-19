import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils';
import { getCurrentAdmin } from '@/lib/auth';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorizedResponse();

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        bnkTag: true,
        dateOfBirth: true,
        kycStatus: true,
        kycTier: true,
        status: true,
        country: true,
        city: true,
        state: true,
        zipCode: true,
        createdAt: true,
        updatedAt: true,
        totpEnabled: true,
        sms2faEnabled: true,
        accounts: {
          where: { status: { not: 'closed' } },
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
          },
          orderBy: { openedAt: 'desc' },
        },
        _count: {
          select: { transactions: true, deposits: true, withdrawals: true, cards: true, notifications: true },
        },
      },
    });

    if (!user) return errorResponse('Customer not found', 404);
    return successResponse(user);
  } catch (error) {
    console.error(error);
    return errorResponse('Unable to load customer', 500);
  }
}
