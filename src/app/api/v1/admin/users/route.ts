import prisma from '@/lib/prisma';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils';
import { hasPermission } from '@/lib/permissions';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const adminId = request.headers.get('x-user-id');
    if (!adminId || request.headers.get('x-user-role')!=='admin') return unauthorizedResponse();
    const admin = await prisma.adminUser.findUnique({ where: { id: adminId }, include: { role: true } });
    if (!admin || !hasPermission(admin.role.permissions as string[], 'users.read')) return forbiddenResponse();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page')||'1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit')||'20')));
    const where: Record<string,unknown> = {};
    if (search) where.OR = [{ email:{contains:search,mode:'insensitive'} },{ firstName:{contains:search,mode:'insensitive'} },{ lastName:{contains:search,mode:'insensitive'} },{ bnkTag:{contains:search,mode:'insensitive'} }];
    if (status) where.status = status;
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, select: { id:true,email:true,firstName:true,lastName:true,bnkTag:true,kycStatus:true,kycTier:true,status:true,createdAt:true,_count:{select:{accounts:true}} }, skip:(page-1)*limit, take:limit, orderBy:{createdAt:'desc'} }),
      prisma.user.count({ where })
    ]);
    return successResponse({ users, pagination:{ page, limit, total, totalPages: Math.ceil(total/limit) } });
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}