import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { logAudit } from './auth';

const money = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);
const ref = (prefix: string) => prefix + '_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase();

/** Central, atomic double-entry journal posting primitive. */
async function postJournal(
  tx: Prisma.TransactionClient,
  input: {
    journalId?: string;
    reference: string;
    currency: string;
    amount: Prisma.Decimal;
    debitAccountId: string;
    creditAccountId: string;
    debitTransaction: { accountId: string; userId: string; description: string; idempotencyKey?: string; ipAddress?: string };
    creditTransaction: { accountId: string; userId: string; description: string };
    txType: string;
  },
) {
  if (input.amount.lte(0)) throw new Error('Journal amount must be greater than zero');
  if (input.debitAccountId === input.creditAccountId) throw new Error('Journal accounts must be distinct');

  const [debitAccount, creditAccount] = await Promise.all([
    tx.account.findUnique({ where: { id: input.debitAccountId } }),
    tx.account.findUnique({ where: { id: input.creditAccountId } }),
  ]);
  if (!debitAccount || !creditAccount) throw new Error('Journal account not found');
  if (debitAccount.currency !== input.currency || creditAccount.currency !== input.currency) throw new Error('Journal currency mismatch');

  const journalId = input.journalId ?? crypto.randomUUID();
  const now = new Date();

  await tx.$executeRaw`
    INSERT INTO "financial_journals" ("id", "reference", "currency", "status", "total_debit", "total_credit", "created_at")
    VALUES (${journalId}, ${input.reference}, ${input.currency}, 'PENDING', ${input.amount}, ${input.amount}, ${now})
  `;

  const debitTx = await tx.transaction.create({
    data: {
      accountId: input.debitTransaction.accountId,
      userId: input.debitTransaction.userId,
      txType: input.txType,
      amount: input.amount,
      currency: input.currency,
      description: input.debitTransaction.description,
      status: 'completed',
      referenceId: input.reference,
      idempotencyKey: input.debitTransaction.idempotencyKey,
      settledAt: now,
      ipAddress: input.debitTransaction.ipAddress,
      journalId,
    },
  });

  const creditTx = await tx.transaction.create({
    data: {
      accountId: input.creditTransaction.accountId,
      userId: input.creditTransaction.userId,
      txType: input.txType,
      amount: input.amount,
      currency: input.currency,
      description: input.creditTransaction.description,
      status: 'completed',
      referenceId: input.reference,
      settledAt: now,
      journalId,
    },
  });

  await tx.ledgerEntry.createMany({
    data: [
      { transactionId: debitTx.id, accountId: input.debitAccountId, direction: 'DEBIT', amount: input.amount, currency: input.currency },
      { transactionId: creditTx.id, accountId: input.creditAccountId, direction: 'CREDIT', amount: input.amount, currency: input.currency },
    ],
  });

  const lines = await tx.ledgerEntry.findMany({ where: { transactionId: { in: [debitTx.id, creditTx.id] } }, select: { direction: true, amount: true } });
  const debits = lines.filter((line) => line.direction === 'DEBIT').reduce((sum, line) => sum.plus(line.amount), money(0));
  const credits = lines.filter((line) => line.direction === 'CREDIT').reduce((sum, line) => sum.plus(line.amount), money(0));
  if (lines.length !== 2 || !debits.eq(credits) || !debits.eq(input.amount)) throw new Error('Unbalanced journal');

  await tx.$executeRaw`
    UPDATE "financial_journals"
    SET "status" = 'POSTED', "posted_at" = ${now}
    WHERE "id" = ${journalId} AND "total_debit" = "total_credit"
  `;

  return { journalId, debitTx, creditTx };
}

async function debitAccount(tx: Prisma.TransactionClient, accountId: string, amount: Prisma.Decimal) {
  const result = await tx.account.updateMany({ where: { id: accountId, status: 'active', availableBalance: { gte: amount } }, data: { balance: { decrement: amount }, availableBalance: { decrement: amount } } });
  if (result.count !== 1) throw new Error('Insufficient funds');
}

async function creditAccount(tx: Prisma.TransactionClient, accountId: string, amount: Prisma.Decimal) {
  const result = await tx.account.updateMany({ where: { id: accountId, status: 'active' }, data: { balance: { increment: amount }, availableBalance: { increment: amount } } });
  if (result.count !== 1) throw new Error('Account is not active');
}

export async function transferFunds(userId: string, input: { senderAccountId: string; recipientAccountNumber: string; amount: string; description?: string; idempotencyKey: string }, meta: { ip?: string; ua?: string }) {
  const existing = await prisma.transfer.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return { transfer: existing, replayed: true };
  const amount = money(input.amount);
  if (amount.lte(0)) throw new Error('Amount must be greater than zero');

  const result = await prisma.$transaction(async (tx) => {
    const raced = await tx.transfer.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (raced) return { transfer: raced, replayed: true };
    const sender = await tx.account.findFirst({ where: { id: input.senderAccountId, userId } });
    if (!sender) throw new Error('Sender account not found');
    if (sender.status !== 'active') throw new Error('Sender account is not active');
    const recipient = await tx.account.findUnique({ where: { accountNumber: input.recipientAccountNumber } });
    if (!recipient) throw new Error('Recipient account not found');
    if (recipient.status !== 'active') throw new Error('Recipient account is not active');
    if (sender.id === recipient.id) throw new Error('Self transfers are not allowed');
    if (sender.currency !== recipient.currency) throw new Error('Currency mismatch');

    const reference = ref('TRF');
    const transfer = await tx.transfer.create({ data: { senderAccountId: sender.id, recipientAccountId: recipient.id, senderUserId: userId, recipientUserId: recipient.userId, amount, fee: 0, totalDebit: amount, currency: sender.currency, description: input.description, status: 'processing', reference, idempotencyKey: input.idempotencyKey } });
    await debitAccount(tx, sender.id, amount);
    await creditAccount(tx, recipient.id, amount);
    const posted = await postJournal(tx, { reference, currency: sender.currency, amount, debitAccountId: sender.id, creditAccountId: recipient.id, debitTransaction: { accountId: sender.id, userId, description: input.description || 'Transfer', idempotencyKey: input.idempotencyKey, ipAddress: meta.ip }, creditTransaction: { accountId: recipient.id, userId: recipient.userId, description: input.description || 'Transfer received' }, txType: 'TRANSFER' });
    const updated = await tx.transfer.update({ where: { id: transfer.id }, data: { status: 'completed', completedAt: new Date() } });
    await tx.notification.createMany({ data: [
      { userId, type: 'TRANSFER_COMPLETED', title: 'Transfer completed', message: `Your transfer of $${amount.toFixed(2)} to account ending ${recipient.accountNumber.slice(-4)} was completed.` },
      { userId: recipient.userId, type: 'TRANSFER_RECEIVED', title: 'Money received', message: `You received $${amount.toFixed(2)} from a Crestline Capital account.` },
    ] });
    return { transfer: updated, journalId: posted.journalId, replayed: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  if (!result.replayed) await logAudit({ actorId: userId, actorType: 'user', action: 'transfer.completed', entityType: 'transfer', entityId: result.transfer.id, ipAddress: meta.ip, userAgent: meta.ua });
  return result;
}

export async function createDeposit(userId: string, input: { accountId: string; amount: string; description?: string }) {
  const amount = money(input.amount);
  if (amount.lte(0)) throw new Error('Amount must be greater than zero');
  const account = await prisma.account.findFirst({ where: { id: input.accountId, userId } });
  if (!account) throw new Error('Account not found');
  if (account.status !== 'active') throw new Error('Account is not active');
  const deposit = await prisma.deposit.create({ data: { accountId: account.id, userId, amount, currency: account.currency, reference: ref('DEP'), status: 'pending', description: input.description } });
  await prisma.notification.create({ data: { userId, type: 'DEPOSIT_SUBMITTED', title: 'Deposit submitted', message: `Your $${amount.toFixed(2)} deposit request is pending review.` } });
  await logAudit({ actorId: userId, actorType: 'user', action: 'deposit.created', entityType: 'deposit', entityId: deposit.id });
  return deposit;
}

export async function approveDeposit(adminId: string, depositId: string, reason?: string) {
  const result = await prisma.$transaction(async (tx) => {
    const deposit = await tx.deposit.findUnique({ where: { id: depositId } });
    if (!deposit) throw new Error('Deposit not found');
    if (deposit.status !== 'pending') throw new Error('Deposit is no longer pending');
    const account = await tx.account.findUnique({ where: { id: deposit.accountId } });
    if (!account || account.status !== 'active') throw new Error('Account is not active');
    const clearing = await tx.account.findFirst({ where: { accountType: 'CLEARING', currency: deposit.currency, status: 'active' } });
    if (!clearing || clearing.id === account.id) throw new Error('Deposit clearing account is not configured');
    await creditAccount(tx, account.id, deposit.amount);
    await creditAccount(tx, clearing.id, deposit.amount);
    await postJournal(tx, { reference: deposit.reference, currency: deposit.currency, amount: deposit.amount, debitAccountId: clearing.id, creditAccountId: account.id, debitTransaction: { accountId: clearing.id, userId: clearing.userId, description: 'Deposit clearing' }, creditTransaction: { accountId: account.id, userId: deposit.userId, description: deposit.description || 'Deposit' }, txType: 'DEPOSIT' });
    const updated = await tx.deposit.update({ where: { id: deposit.id }, data: { status: 'completed', completedAt: new Date() } });
    await tx.notification.create({ data: { userId: deposit.userId, type: 'DEPOSIT_COMPLETED', title: 'Deposit completed', message: `Your $${deposit.amount.toFixed(2)} deposit was approved.` } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await logAudit({ actorId: adminId, actorType: 'admin', action: 'deposit.approve', entityType: 'deposit', entityId: depositId, changes: reason ? { reason } : undefined });
  return result;
}

export async function rejectDeposit(adminId: string, depositId: string, reason?: string) {
  const result = await prisma.$transaction(async (tx) => {
    const deposit = await tx.deposit.findUnique({ where: { id: depositId } });
    if (!deposit) throw new Error('Deposit not found');
    if (deposit.status !== 'pending') throw new Error('Deposit is no longer pending');
    const updated = await tx.deposit.update({ where: { id: depositId }, data: { status: 'rejected' } });
    await tx.notification.create({ data: { userId: deposit.userId, type: 'DEPOSIT_REJECTED', title: 'Deposit rejected', message: reason ? `Your deposit was rejected: ${reason}` : 'Your deposit request was rejected.' } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await logAudit({ actorId: adminId, actorType: 'admin', action: 'deposit.reject', entityType: 'deposit', entityId: depositId, changes: reason ? { reason } : undefined });
  return result;
}

export async function createWithdrawal(userId: string, input: { accountId: string; amount: string; destination: string; description?: string }) {
  const amount = money(input.amount);
  if (amount.lte(0)) throw new Error('Amount must be greater than zero');
  const account = await prisma.account.findFirst({ where: { id: input.accountId, userId } });
  if (!account) throw new Error('Account not found');
  if (account.status !== 'active') throw new Error('Account is not active');
  const withdrawal = await prisma.withdrawal.create({ data: { accountId: account.id, userId, amount, currency: account.currency, destination: input.destination, reference: ref('WDR'), status: 'pending', description: input.description } });
  await prisma.notification.create({ data: { userId, type: 'WITHDRAWAL_SUBMITTED', title: 'Withdrawal submitted', message: `Your $${amount.toFixed(2)} withdrawal request is pending approval.` } });
  await logAudit({ actorId: userId, actorType: 'user', action: 'withdrawal.created', entityType: 'withdrawal', entityId: withdrawal.id });
  return withdrawal;
}

export async function approveWithdrawal(adminId: string, withdrawalId: string, reason?: string) {
  const result = await prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new Error('Withdrawal not found');
    if (withdrawal.status !== 'pending') throw new Error('Withdrawal is no longer pending');
    const account = await tx.account.findUnique({ where: { id: withdrawal.accountId } });
    if (!account || account.status !== 'active') throw new Error('Account is not active');
    const clearing = await tx.account.findFirst({ where: { accountType: 'CLEARING', currency: withdrawal.currency, status: 'active' } });
    if (!clearing || clearing.id === account.id) throw new Error('Withdrawal clearing account is not configured');
    await debitAccount(tx, account.id, withdrawal.amount);
    await creditAccount(tx, clearing.id, withdrawal.amount);
    await postJournal(tx, { reference: withdrawal.reference, currency: withdrawal.currency, amount: withdrawal.amount, debitAccountId: account.id, creditAccountId: clearing.id, debitTransaction: { accountId: account.id, userId: withdrawal.userId, description: withdrawal.description || 'Withdrawal' }, creditTransaction: { accountId: clearing.id, userId: clearing.userId, description: 'Withdrawal clearing' }, txType: 'WITHDRAWAL' });
    const updated = await tx.withdrawal.update({ where: { id: withdrawal.id }, data: { status: 'completed', reviewedAt: new Date(), reviewedBy: adminId } });
    await tx.notification.create({ data: { userId: withdrawal.userId, type: 'WITHDRAWAL_APPROVED', title: 'Withdrawal approved', message: `Your $${withdrawal.amount.toFixed(2)} withdrawal was approved.` } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await logAudit({ actorId: adminId, actorType: 'admin', action: 'withdrawal.approve', entityType: 'withdrawal', entityId: withdrawalId, changes: reason ? { reason } : undefined });
  return result;
}

export async function rejectWithdrawal(adminId: string, withdrawalId: string, reason?: string) {
  const result = await prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new Error('Withdrawal not found');
    if (withdrawal.status !== 'pending') throw new Error('Withdrawal is no longer pending');
    const updated = await tx.withdrawal.update({ where: { id: withdrawalId }, data: { status: 'rejected', reviewedAt: new Date(), reviewedBy: adminId } });
    await tx.notification.create({ data: { userId: withdrawal.userId, type: 'WITHDRAWAL_REJECTED', title: 'Withdrawal rejected', message: reason ? `Your withdrawal was rejected: ${reason}` : 'Your withdrawal request was rejected.' } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await logAudit({ actorId: adminId, actorType: 'admin', action: 'withdrawal.reject', entityType: 'withdrawal', entityId: withdrawalId, changes: reason ? { reason } : undefined });
  return result;
}
