import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successResponse, unauthorizedResponse, errorResponse } from '@/lib/api-utils';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    const url = new URL(req.url);
    const rawTake = Number(url.searchParams.get('limit') || 25);
    const rawSkip = Number(url.searchParams.get('skip') || 0);
    const take = Number.isFinite(rawTake) ? Math.min(Math.max(rawTake, 1), 100) : 25;
    const skip = Number.isFinite(rawSkip) ? Math.max(rawSkip, 0) : 0;
    const type = url.searchParams.get('type') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const where = { userId: user.id, ...(type ? { txType: type } : {}), ...(status ? { status } : {}) };
    const [items,total] = await Promise.all([
      prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.transaction.count({ where }),
    ]);
    return successResponse({ items, total, skip, take });
  } catch (e) {
    console.error(e);
    return errorResponse('Internal server error', 500);
  }
}
