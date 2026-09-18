import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { logAudit } from './auth';

const money=(v:string|number)=>new Prisma.Decimal(v);
const ref=(prefix:string)=>prefix+'_'+crypto.randomUUID().replace(/-/g,'').slice(0,20).toUpperCase();

export async function transferFunds(userId:string, input:{senderAccountId:string;recipientAccountNumber:string;amount:string;description?:string;idempotencyKey:string}, meta:{ip?:string;ua?:string}) {
  const existing=await prisma.transfer.findUnique({where:{idempotencyKey:input.idempotencyKey}});
  if(existing) return {transfer:existing,replayed:true};
  const amount=money(input.amount);
  if(amount.lte(0)) throw new Error('Amount must be greater than zero');
  const result=await prisma.$transaction(async tx=>{
    const sender=await tx.account.findFirst({where:{id:input.senderAccountId,userId}});
    if(!sender) throw new Error('Sender account not found');
    if(sender.status!=='active') throw new Error('Sender account is not active');
    const recipient=await tx.account.findUnique({where:{accountNumber:input.recipientAccountNumber}});
    if(!recipient) throw new Error('Recipient account not found');
    if(recipient.status!=='active') throw new Error('Recipient account is not active');
    if(sender.id===recipient.id) throw new Error('Self transfers are not allowed');
    const total=amount;
    const reference=ref('TRF');
    const transfer=await tx.transfer.create({data:{senderAccountId:sender.id,recipientAccountId:recipient.id,senderUserId:userId,recipientUserId:recipient.userId,amount,fee:0,totalDebit:total,currency:sender.currency,description,status:'completed',reference,idempotencyKey:input.idempotencyKey,completedAt:new Date()}});
    const reserved=await tx.account.updateMany({where:{id:sender.id,status:'active',availableBalance:{gte:total}},data:{balance:{decrement:total},availableBalance:{decrement:total}}});
    if(reserved.count!==1) throw new Error('Insufficient funds');
    const debit=await tx.account.findUniqueOrThrow({where:{id:sender.id}});
    const credit=await tx.account.update({where:{id:recipient.id},data:{balance:{increment:amount},availableBalance:{increment:amount}}});
    const senderTx=await tx.transaction.create({data:{accountId:sender.id,userId,txType:'TRANSFER',amount:total,currency:sender.currency,description:description||'Transfer',status:'completed',referenceId:reference,idempotencyKey:input.idempotencyKey,settledAt:new Date(),runningBalance:debit.balance,ipAddress:meta.ip}});
    const recipientTx=await tx.transaction.create({data:{accountId:recipient.id,userId:recipient.userId,txType:'TRANSFER',amount, currency:recipient.currency,description:description||'Transfer received',status:'completed',referenceId:reference,settledAt:new Date(),runningBalance:credit.balance}});
    await tx.ledgerEntry.createMany({data:[
      {transactionId:senderTx.id,accountId:sender.id,direction:'DEBIT',amount:total,currency:sender.currency},
      {transactionId:recipientTx.id,accountId:recipient.id,direction:'CREDIT',amount,currency:recipient.currency}
    ]});
    await tx.notification.createMany({data:[
      {userId, type:'TRANSFER_COMPLETED', title:'Transfer completed', message:`Your transfer of $${amount.toFixed(2)} to account ending ${recipient.accountNumber.slice(-4)} was completed.`},
      {userId:recipient.userId,type:'TRANSFER_RECEIVED',title:'Money received',message:`You received $${amount.toFixed(2)} from a Crestline Capital account.`}
    ]});
    return transfer;
  });
  await logAudit({actorId:userId,actorType:'user',action:'transfer.completed',entityType:'transfer',entityId:result.id,ipAddress:meta.ip,userAgent:meta.ua});
  return {transfer:result,replayed:false};
}

export async function createDeposit(userId:string,input:{accountId:string;amount:string;description?:string}) {
 const amount=money(input.amount); if(amount.lte(0)) throw new Error('Amount must be greater than zero');
 const account=await prisma.account.findFirst({where:{id:input.accountId,userId}});
 if(!account) throw new Error('Account not found'); if(account.status!=='active') throw new Error('Account is not active');
 const deposit=await prisma.deposit.create({data:{accountId:account.id,userId,amount,currency:account.currency,reference:ref('DEP'),status:'pending',description:input.description}});
 await prisma.notification.create({data:{userId,type:'DEPOSIT_SUBMITTED',title:'Deposit submitted',message:`Your $${amount.toFixed(2)} deposit request is pending review.`}});
 await logAudit({actorId:userId,actorType:'user',action:'deposit.created',entityType:'deposit',entityId:deposit.id});
 return deposit;
}

export async function createWithdrawal(userId:string,input:{accountId:string;amount:string;destination:string;description?:string}) {
 const amount=money(input.amount); if(amount.lte(0)) throw new Error('Amount must be greater than zero');
 const account=await prisma.account.findFirst({where:{id:input.accountId,userId}});
 if(!account) throw new Error('Account not found'); if(account.status!=='active') throw new Error('Account is not active');
 const withdrawal=await prisma.withdrawal.create({data:{accountId:account.id,userId,amount,currency:account.currency,destination,reference:ref('WDR'),status:'pending',description:input.description}});
 await prisma.notification.create({data:{userId,type:'WITHDRAWAL_SUBMITTED',title:'Withdrawal submitted',message:`Your $${amount.toFixed(2)} withdrawal request is pending approval.`}});
 await logAudit({actorId:userId,actorType:'user',action:'withdrawal.created',entityType:'withdrawal',entityId:withdrawal.id});
 return withdrawal;
}
