import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { successResponse, unauthorizedResponse } from '@/lib/api-utils';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const cards = await prisma.card.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { account: { select: { accountNumber: true, currency: true } } },
  });
  return successResponse(cards);
}
