import { successResponse } from '../../../lib/api-utils';
import prisma from '../../../lib/prisma';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return successResponse({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch {
    return Response.json({ success: false, error: 'Database connection failed' }, { status: 503 });
  }
}
