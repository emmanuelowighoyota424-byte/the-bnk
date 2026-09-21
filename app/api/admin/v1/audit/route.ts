import { NextRequest,NextResponse } from 'next/server'
import { requireAdminCapability } from '@/lib/auth/admin-rbac'
import { prisma } from '@/lib/prisma'
export async function GET(request:NextRequest){const admin=await requireAdminCapability('audit');if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401});const p=request.nextUrl.searchParams;const items=await prisma.auditLog.findMany({where:{...(p.get('actor')?{actorId:p.get('actor')!}:{})},orderBy:{createdAt:'desc'},take:200});return NextResponse.json({items})}
