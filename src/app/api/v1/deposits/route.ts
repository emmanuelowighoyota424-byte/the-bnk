import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createDeposit } from '@/lib/banking';
import { errorResponse, successResponse, unauthorizedResponse, validateBody } from '@/lib/api-utils';
import { getCurrentUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

const schema = z.object({
  accountId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  description: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const v = validateBody(schema, await req.json());
  if (!v.success) return errorResponse('Validation failed', 400, v.errors);
  const idempotencyKey = req.headers.get('idempotency-key') || crypto.randomUUID();
  try { return successResponse(await createDeposit(user.id, { ...v.data, idempotencyKey }), 201); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Deposit failed', 400); }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  return successResponse(await prisma.deposit.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 }));
}
