import { NextRequest, NextResponse } from 'next/server'
import { requireAdminCapability } from '@/lib/auth/admin-rbac'
import { prisma } from '@/lib/prisma'
export async function GET(request:NextRequest){
 const admin=await requireAdminCapability('viewUsers'); if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401})
 const p=request.nextUrl.searchParams, search=p.get('search')||'', status=p.get('status')||'', page=Math.max(1,Number(p.get('page')||1)), limit=Math.min(100,Math.max(10,Number(p.get('limit')||25)))
 const where={...(search?{OR:[{email:{contains:search,mode:'insensitive' as const}},{firstName:{contains:search,mode:'insensitive' as const}},{lastName:{contains:search,mode:'insensitive' as const}}]}:{}),...(status?{status}: {})}
 const [items,total]=await Promise.all([prisma.user.findMany({where,orderBy:{createdAt:'desc'},skip:(page-1)*limit,take:limit,select:{id:true,email:true,firstName:true,lastName:true,phone:true,status:true,kycStatus:true,kycTier:true,createdAt:true,accounts:{select:{id:true,accountNumber:true,balance:true,currency:true,status:true}}}}),prisma.user.count({where})])
 return NextResponse.json({items,total,page,limit,pages:Math.ceil(total/limit)})
}
