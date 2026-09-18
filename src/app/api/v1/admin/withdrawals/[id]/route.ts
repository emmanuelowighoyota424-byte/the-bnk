import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { errorResponse, successResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils';
import { logAudit, getCurrentAdmin } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function POST(req: NextRequest,{params}:{params:{id:string}}){
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorizedResponse();
  if (!hasPermission(admin.role.permissions as string[], 'withdrawals.manage')) return forbiddenResponse();
  try {
    const body = await req.json();
    const action = body.action === 'reject' ? 'reject' : body.action === 'approve' ? 'approve' : null;
    if (!action) return errorResponse('Invalid action',400);
    const result = await prisma.$transaction(async tx=>{
      const w=await tx.withdrawal.findUnique({where:{id:params.id}});
      if(!w) throw new Error('Withdrawal not found');
      if(w.status!=='pending') throw new Error('Withdrawal is no longer pending');
      if(action==='reject'){
        const updated=await tx.withdrawal.update({where:{id:w.id},data:{status:'rejected',reviewedAt:new Date(),reviewedBy:admin.id}});
        await tx.notification.create({data:{userId:w.userId,type:'WITHDRAWAL_REJECTED',title:'Withdrawal rejected',message:'Your withdrawal request was rejected.'}});
        return updated;
      }
      const account=await tx.account.findUnique({where:{id:w.accountId}});
      if(!account) throw new Error('Account not found');
      if(account.status!=='active') throw new Error('Account is not active');
      const reserved=await tx.account.updateMany({where:{id:account.id,status:'active',availableBalance:{gte:w.amount}},data:{balance:{decrement:w.amount},availableBalance:{decrement:w.amount}}});
      if(reserved.count!==1) throw new Error('Insufficient funds');
      const updated=await tx.account.findUniqueOrThrow({where:{id:account.id}});
      const tr=await tx.transaction.create({data:{accountId:account.id,userId:w.userId,txType:'WITHDRAWAL',amount:w.amount,currency:w.currency,description:w.description||'Withdrawal',status:'completed',referenceId:w.reference,settledAt:new Date(),runningBalance:updated.balance}});
      await tx.ledgerEntry.create({data:{transactionId:tr.id,accountId:account.id,direction:'DEBIT',amount:w.amount,currency:w.currency}});
      await tx.notification.create({data:{userId:w.userId,type:'WITHDRAWAL_APPROVED',title:'Withdrawal approved',message:'Your withdrawal of $'+w.amount.toFixed(2)+' was approved.'}});
      return tx.withdrawal.update({where:{id:w.id},data:{status:'approved',reviewedAt:new Date(),reviewedBy:admin.id}});
    });
    await logAudit({actorId:admin.id,actorType:'admin',action:'withdrawal.'+action,entityType:'withdrawal',entityId:params.id});
    return successResponse(result);
  } catch(e) {
    return errorResponse(e instanceof Error?e.message:'Operation failed',400);
  }
}
