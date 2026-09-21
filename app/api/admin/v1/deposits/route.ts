import { NextRequest,NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/admin'
import { prisma } from '@/lib/prisma'
export async function GET(request:NextRequest){const admin=await requireAdmin();if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401});const status=request.nextUrl.searchParams.get('status')||'pending';const items=await prisma.deposit.findMany({where:{status},orderBy:{createdAt:'asc'},take:200,include:{user:{select:{id:true,email:true,firstName:true,lastName:true}},account:{select:{id:true,accountNumber:true,balance:true,currency:true}}}});return NextResponse.json({items})}
