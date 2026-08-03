import prisma from '@/lib/prisma';
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, validateBody } from '@/lib/api-utils';
import { hasPermission } from '@/lib/permissions';
import { logAudit } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const createRoleSchema = z.object({ name: z.string().min(2), description: z.string().optional(), permissions: z.array(z.string()).min(1) });

export async function GET(request: NextRequest) {
  try {
    const adminId = request.headers.get('x-user-id');
    if (!adminId || request.headers.get('x-user-role')!=='admin') return unauthorizedResponse();
    const admin = await prisma.adminUser.findUnique({ where: { id: adminId }, include: { role: true } });
    if (!admin || !hasPermission(admin.role.permissions as string[], 'roles.read')) return forbiddenResponse();
    const roles = await prisma.role.findMany({ include: { _count: { select: { admins: true } } }, orderBy: { createdAt: 'asc' } });
    return successResponse(roles);
  } catch (e) { console.error(e); return errorResponse('Internal server error', 500); }
}

export async function POST(request: NextRequest) {
  try {
    const adminId = request.headers.get('x-user-id');
    if (!adminId || request.headers.get('x-user-role')!=='admin') return unauthorizedResponse();
    const admin = await prisma.adminUser.findUnique({ where: { id: adminId }, include: { role: true } });
    if (!admin || !hasPermission(admin.role.permissions as string[], 'roles.write')) return forbiddenResponse();
    const body = await request.json();
    const v = validateBody(createRoleSchema, body);
    if (!v.success) return errorResponse('Validation failed', 400, v.errors);
    const newRole = await prisma.role.create({ data: { name: v.data.name, description: v.data.description, permissions: v.data.permissions } });
    await logAudit({ actorId: adminId, actorType: 'admin', action: 'role.create', entityType: 'roles', entityId: newRole.id, changes: { name: newRole.name } });
    return successResponse(newRole, 201);
  } catch (e: unknown) { if (e && typeof e === 'object' && 'code' in e && (e as {code:string}).code==='P2002') return errorResponse('A role with this name already exists', 409); console.error(e); return errorResponse('Internal server error', 500); }
}