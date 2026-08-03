import prisma from '@/lib/prisma';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils';
import { hasPermission } from '@/lib/permissions';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const adminId = request.headers.get('x-user-id');
    if (!adminId || request.headers.get('x-user-role')!=='admin') return unauthorizedResponse();
    const admin = await prisma.adminUser.findUnique({ where: { id: adminId }, include: { role: true } });
    if (!admin || !hasPermission(admin.role.permissions as string[], 'audit.read')) return forbiddenResponse();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page')||'1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit')||'50')));
    const where: Record<string,unknown> = {};
    if (action) where.action = action;
    const [logs, total] = await Promise.all([prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page-1)*limit, take: limit }), prisma.auditLog.count({ where })]);
    return successResponse({ logs, pagination: { page, limit, total, totalPages: Math.ceil(total/limit) } });
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}