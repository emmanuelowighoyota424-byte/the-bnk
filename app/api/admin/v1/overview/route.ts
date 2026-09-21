import { NextResponse } from 'next/server'
import { requireAdminCapability } from '@/lib/auth/admin-rbac'
import { prisma } from '@/lib/prisma'
export async function GET() {
 const admin=await requireAdminCapability('viewUsers'); if(!admin) return NextResponse.json({error:'Unauthorized'},{status:401})
 const [users,accounts,txs,pendingDeposits,pendingWithdrawals,kyc] = await Promise.all([
  prisma.user.count(), prisma.account.count(), prisma.transaction.count(),
  prisma.deposit.count({where:{status:'pending'}}), prisma.withdrawal.count({where:{status:'pending'}}),
  prisma.user.count({where:{kycStatus:'pending'}})
 ])
 const balances=await prisma.account.aggregate({_sum:{balance:true,availableBalance:true}})
 return NextResponse.json({stats:{users,accounts,transactions:txs,pendingDeposits,pendingWithdrawals,pendingKyc:kyc,totalBalance:balances._sum.balance?.toString()||'0',availableBalance:balances._sum.availableBalance?.toString()||'0'},admin:{id:admin.id,email:admin.email,displayName:admin.displayName,role:admin.role.name}})
}
