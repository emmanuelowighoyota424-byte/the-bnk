import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { successResponse, unauthorizedResponse, errorResponse } from '@/lib/api-utils';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    const url = new URL(req.url);
    const rawLimit = Number(url.searchParams.get('limit') || 25);
    const rawSkip = Number(url.searchParams.get('skip') || 0);
    const take = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100) : 25;
    const skip = Number.isFinite(rawSkip) ? Math.max(Math.trunc(rawSkip), 0) : 0;
    const type = url.searchParams.get('type') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const q = url.searchParams.get('q')?.trim().slice(0, 100) || undefined;
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const accountId = url.searchParams.get('accountId') || undefined;

    let createdAt: { gte?: Date; lte?: Date } | undefined;
    if (from || to) {
      createdAt = {};
      if (from) {
        const date = new Date(`${from}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime())) return errorResponse('Invalid start date', 400);
        createdAt.gte = date;
      }
      if (to) {
        const date = new Date(`${to}T23:59:59.999Z`);
        if (Number.isNaN(date.getTime())) return errorResponse('Invalid end date', 400);
        createdAt.lte = date;
      }
    }

    const where = {
      userId: user.id,
      ...(type && type !== 'ALL' ? { txType: type } : {}),
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(accountId ? { accountId } : {}),
      ...(createdAt ? { createdAt } : {}),
      ...(q ? { OR: [
        { description: { contains: q, mode: 'insensitive' as const } },
        { merchantName: { contains: q, mode: 'insensitive' as const } },
        { referenceId: { contains: q, mode: 'insensitive' as const } },
        { id: { contains: q, mode: 'insensitive' as const } },
      ] } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      prisma.transaction.count({ where }),
    ]);
    return successResponse({ items, total, skip, take });
  } catch (e) {
    console.error(e);
    return errorResponse('Internal server error', 500);
  }
}
