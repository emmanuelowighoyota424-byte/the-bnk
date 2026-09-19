import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { errorResponse, successResponse, unauthorizedResponse, validateBody } from '@/lib/api-utils';
import { issueTransactionCode } from '@/lib/transaction-code';

const schema = z.object({ type: z.enum(['TRANSFER','WITHDRAWAL']), payload: z.record(z.unknown()) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  const validation = validateBody(schema, await req.json());
  if (!validation.success) return errorResponse('Validation failed', 400, validation.errors);
  try {
    const result = await issueTransactionCode(user.id, validation.data.type, validation.data.payload);
    return successResponse({ message: 'Security code sent to your email.', expiresAt: result.expiresAt });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unable to send security code', 400);
  }
}
