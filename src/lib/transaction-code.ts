import { createHash, randomInt } from 'crypto';
import prisma from './prisma';
import { sendTransactionCodeEmail } from './email';

type CodeType = 'TRANSFER' | 'WITHDRAWAL';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const requestHash = (payload: unknown) => hash(JSON.stringify(payload));

export async function issueTransactionCode(userId: string, type: CodeType, payload: unknown) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, status: true } });
  if (!user || user.status !== 'active') throw new Error('Account is not active');
  if (type === 'TRANSFER') {
    const blocked = await prisma.user.findUnique({ where: { id: userId }, select: { transferBlocked: true, transferBlockMessage: true } });
    if (blocked?.transferBlocked) throw new Error(blocked.transferBlockMessage || 'Transfers and send money are currently blocked on your account.');
  }
  if (type === 'WITHDRAWAL') {
    const blocked = await prisma.user.findUnique({ where: { id: userId }, select: { withdrawalBlocked: true, withdrawalBlockMessage: true } });
    if (blocked?.withdrawalBlocked) throw new Error(blocked.withdrawalBlockMessage || 'Withdrawals are currently blocked on your account.');
  }
  const code = String(randomInt(100000, 1000000));
  await prisma.transactionVerificationCode.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } });
  const record = await prisma.transactionVerificationCode.create({ data: { userId, type, codeHash: hash(code), requestHash: requestHash(payload), expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
  await sendTransactionCodeEmail(user.email, code, type);
  return { expiresAt: record.expiresAt };
}

export async function verifyTransactionCode(userId: string, type: CodeType, code: string, payload: unknown) {
  const record = await prisma.transactionVerificationCode.findFirst({ where: { userId, type, usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
  if (!record) throw new Error('Security code expired or not requested.');
  if (record.attempts >= 5) throw new Error('Too many invalid security code attempts. Request a new code.');
  if (record.requestHash !== requestHash(payload)) throw new Error('Security code does not match these transaction details.');
  if (record.codeHash !== hash(code)) {
    await prisma.transactionVerificationCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    throw new Error('Invalid security code.');
  }
  await prisma.transactionVerificationCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
  return true;
}
