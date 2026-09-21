import { NextRequest,NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
export async function GET(request:NextRequest){const admin=await requireAdmin();if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401});const p=request.nextUrl.searchParams;const items=await prisma.auditLog.findMany({where:{...(p.get('actor')?{actorId:p.get('actor')!}:{})},orderBy:{createdAt:'desc'},take:200});return NextResponse.json({items})}
