import { NextResponse } from 'next/server'
import { requireAdminCapability } from '@/lib/auth/admin-rbac'
import { prisma } from '@/lib/prisma'
export async function GET(){const admin=await requireAdminCapability('kyc');if(!admin)return NextResponse.json({error:'Unauthorized'},{status:401});const items=await prisma.kYCDocument.findMany({where:{verificationStatus:'pending'},orderBy:{createdAt:'asc'},take:200,include:{user:{select:{id:true,email:true,firstName:true,lastName:true,kycStatus:true}}}});return NextResponse.json({items})}
