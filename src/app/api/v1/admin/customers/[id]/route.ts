import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { errorResponse, successResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils';
import { getCurrentAdmin, logAudit } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';
import { adjustCustomerBalance } from '@/lib/banking';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorizedResponse();
  const user = await prisma.user.findUnique({ where: { id: params.id }, select: {
    id:true,email:true,phone:true,firstName:true,lastName:true,bnkTag:true,dateOfBirth:true,kycStatus:true,kycTier:true,status:true,
    country:true,city:true,state:true,zipCode:true,createdAt:true,updatedAt:true,totpEnabled:true,sms2faEnabled:true,
    transferBlocked:true,transferBlockMessage:true,withdrawalBlocked:true,withdrawalBlockMessage:true,
    accounts:{where:{status:{not:'closed'}},select:{id:true,accountType:true,accountNumber:true,routingNumber:true,balance:true,availableBalance:true,currency:true,status:true,interestRate:true,openedAt:true},orderBy:{openedAt:'desc'}},
    _count:{select:{transactions:true,deposits:true,withdrawals:true,cards:true,notifications:true}},
  }});
  if (!user) return errorResponse('Customer not found',404);
  return successResponse(user);
}
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentAdmin();
  if (!admin) return unauthorizedResponse();
  if (!hasPermission(admin.role.permissions as string[], 'users.write')) return forbiddenResponse();
  try {
    const body = await req.json();
    if (body.action === 'balance') {
      if (!['credit','debit'].includes(body.direction)) return errorResponse('Invalid balance direction',400);
      return successResponse(await adjustCustomerBalance(admin.id,{userId:params.id,accountId:String(body.accountId||''),amount:String(body.amount||''),direction:body.direction,reason:String(body.reason||'')}));
    }
    if (body.action === 'transaction-blocks') {
      const transferBlocked = Boolean(body.transferBlocked), withdrawalBlocked = Boolean(body.withdrawalBlocked);
      const transferBlockMessage = transferBlocked ? String(body.transferBlockMessage||'').trim().slice(0,500) : null;
      const withdrawalBlockMessage = withdrawalBlocked ? String(body.withdrawalBlockMessage||'').trim().slice(0,500) : null;
      if (transferBlocked && !transferBlockMessage) return errorResponse('Transfer block message is required',400);
      if (withdrawalBlocked && !withdrawalBlockMessage) return errorResponse('Withdrawal block message is required',400);
      const user = await prisma.user.update({where:{id:params.id},data:{transferBlocked,transferBlockMessage,withdrawalBlocked,withdrawalBlockMessage}});
      await logAudit({actorId:admin.id,actorType:'admin',action:'customer.transaction_blocks.update',entityType:'user',entityId:params.id,changes:{transferBlocked,withdrawalBlocked,transferBlockMessage,withdrawalBlockMessage}});
      return successResponse(user);
    }
    return errorResponse('Unsupported customer action',400);
  } catch (error) { return errorResponse(error instanceof Error ? error.message : 'Customer update failed',400); }
}
