import { NextRequest } from 'next/server';
import { z } from 'zod';
import { transferFunds } from '@/lib/banking';
import { errorResponse, successResponse, unauthorizedResponse, validateBody } from '@/lib/api-utils';

const schema = z.object({
  senderAccountId: z.string().uuid(),
  recipientAccountNumber: z.string().min(4).max(32),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  description: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) return unauthorizedResponse();
  const v = validateBody(schema, await req.json());
  if (!v.success) return errorResponse('Validation failed', 400, v.errors);
  const key = req.headers.get('idempotency-key') || crypto.randomUUID();
  try {
    return successResponse(await transferFunds(userId, { ...v.data, idempotencyKey: key }, {
      ip: req.headers.get('x-forwarded-for') || undefined,
      ua: req.headers.get('user-agent') || undefined,
    }), 201);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Transfer failed', 400);
  }
}
