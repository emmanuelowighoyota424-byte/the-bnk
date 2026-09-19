import { Prisma } from '@prisma/client';
import prisma from './prisma';
import { logAudit } from './auth';

const money = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);
const ref = (prefix: string) => prefix + '_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase();

type MovementType = 'TRANSFER' | 'DEPOSIT' | 'WITHDRAWAL';

type JournalInput = {
  reference: string;
  currency: string;
  amount: Prisma.Decimal;
  debitAccountId: string;
  creditAccountId: string;
  movementType: MovementType;
  movementId: string;
  idempotencyKey?: string;
  debitTransaction: { accountId: string; userId: string; description: string; idempotencyKey?: string; ipAddress?: string };
  creditTransaction: { accountId: string; userId: string; description: string };
  debitTxType: string;
  creditTxType: string;
};

function isRetryableTransactionError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2034';
}

async function serializableTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!isRetryableTransactionError(error) || attempt === 3) throw error;
    }
  }
  throw new Error('Transaction retry limit exceeded');
}

/**
 * The single authoritative financial posting primitive.
 * It owns both ledger-side balance mutations and the double-entry journal.
 * Callers must not mutate Account.balance/availableBalance for financial movements.
 */
async function postJournal(tx: Prisma.TransactionClient, input: JournalInput) {
  if (input.amount.lte(0)) throw new Error('Journal amount must be greater than zero');
  if (input.debitAccountId === input.creditAccountId) throw new Error('Journal accounts must be distinct');
  if (!input.movementId) throw new Error('Journal movement identity is required');

  // Lock both accounts in a deterministic order so opposing transfers cannot deadlock.
  await tx.$queryRaw`
    SELECT "id" FROM "accounts"
    WHERE "id" = ${input.debitAccountId} OR "id" = ${input.creditAccountId}
    ORDER BY "id"
    FOR UPDATE
  `;

  const debitAccount = await tx.account.findUnique({ where: { id: input.debitAccountId } });
  const creditAccount = await tx.account.findUnique({ where: { id: input.creditAccountId } });
  if (!debitAccount || !creditAccount) throw new Error('Journal account not found');
  if (debitAccount.status !== 'active' || creditAccount.status !== 'active') throw new Error('Journal account is not active');
  if (debitAccount.currency !== input.currency || creditAccount.currency !== input.currency) throw new Error('Journal currency mismatch');

  const journalId = crypto.randomUUID();
  const now = new Date();
  const sourceType = input.movementType;
  const sourceId = input.movementId;
  const journalIdempotencyKey = input.idempotencyKey ?? `${sourceType}:${sourceId}`;

  await tx.$executeRaw`
    INSERT INTO "financial_journals"
      ("id", "reference", "currency", "status", "total_debit", "total_credit", "idempotency_key", "source_type", "source_id", "created_at")
    VALUES
      (${journalId}, ${input.reference}, ${input.currency}, 'PENDING', ${input.amount}, ${input.amount}, ${journalIdempotencyKey}, ${sourceType}, ${sourceId}, ${now})
  `;

  const debitResult = await tx.account.updateMany({
    where: { id: input.debitAccountId, status: 'active', availableBalance: { gte: input.amount } },
    data: { balance: { decrement: input.amount }, availableBalance: { decrement: input.amount } },
  });
  if (debitResult.count !== 1) throw new Error('Insufficient funds');

  const creditResult = await tx.account.updateMany({
    where: { id: input.creditAccountId, status: 'active' },
    data: { balance: { increment: input.amount }, availableBalance: { increment: input.amount } },
  });
  if (creditResult.count !== 1) throw new Error('Credit account is not active');

  const [debitAfter, creditAfter] = await Promise.all([
    tx.account.findUniqueOrThrow({ where: { id: input.debitAccountId }, select: { balance: true } }),
    tx.account.findUniqueOrThrow({ where: { id: input.creditAccountId }, select: { balance: true } }),
  ]);

  const debitTx = await tx.transaction.create({
    data: {
      accountId: input.debitTransaction.accountId,
      userId: input.debitTransaction.userId,
      txType: input.debitTxType,
      amount: input.amount,
      currency: input.currency,
      description: input.debitTransaction.description,
      status: 'completed',
      referenceId: input.reference,
      idempotencyKey: input.debitTransaction.idempotencyKey,
      settledAt: now,
      ipAddress: input.debitTransaction.ipAddress,
      runningBalance: debitAfter.balance,
      journalId,
    },
  });

  const creditTx = await tx.transaction.create({
    data: {
      accountId: input.creditTransaction.accountId,
      userId: input.creditTransaction.userId,
      txType: input.creditTxType,
      amount: input.amount,
      currency: input.currency,
      description: input.creditTransaction.description,
      status: 'completed',
      referenceId: input.reference,
      settledAt: now,
      runningBalance: creditAfter.balance,
      journalId,
    },
  });

  await tx.$executeRaw`
    INSERT INTO "ledger_entries" ("id", "transaction_id", "account_id", "journal_id", "direction", "amount", "currency", "created_at")
    VALUES
      (${crypto.randomUUID()}, ${debitTx.id}, ${input.debitAccountId}, ${journalId}, 'DEBIT', ${input.amount}, ${input.currency}, ${now}),
      (${crypto.randomUUID()}, ${creditTx.id}, ${input.creditAccountId}, ${journalId}, 'CREDIT', ${input.amount}, ${input.currency}, ${now})
  `;

  const lines = await tx.$queryRaw<Array<{ direction: string; amount: Prisma.Decimal }>>`
    SELECT "direction", "amount" FROM "ledger_entries" WHERE "journal_id" = ${journalId}
  `;
  const debits = lines.filter((line) => line.direction === 'DEBIT').reduce((sum, line) => sum.plus(line.amount), money(0));
  const credits = lines.filter((line) => line.direction === 'CREDIT').reduce((sum, line) => sum.plus(line.amount), money(0));
  if (lines.length !== 2 || !debits.eq(credits) || !debits.eq(input.amount)) throw new Error('Unbalanced journal');

  const posted = await tx.$executeRaw`
    UPDATE "financial_journals"
    SET "status" = 'POSTED', "posted_at" = ${now}
    WHERE "id" = ${journalId} AND "status" = 'PENDING' AND "total_debit" = "total_credit"
  `;
  if (posted !== 1) throw new Error('Journal could not be posted');

  return { journalId, debitTx, creditTx };
}

export async function transferFunds(userId: string, input: { senderAccountId: string; recipientAccountNumber: string; amount: string; description?: string; idempotencyKey: string }, meta: { ip?: string; ua?: string }) {
  const existing = await prisma.transfer.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return { transfer: existing, replayed: true };
  const amount = money(input.amount);
  if (amount.lte(0)) throw new Error('Amount must be greater than zero');

  const result = await serializableTransaction(async (tx) => {
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
    const posted = await postJournal(tx, {
      reference,
      currency: sender.currency,
      amount,
      debitAccountId: sender.id,
      creditAccountId: recipient.id,
      movementType: 'TRANSFER',
      movementId: transfer.id,
      idempotencyKey: input.idempotencyKey,
      debitTransaction: { accountId: sender.id, userId, description: input.description || 'Transfer', idempotencyKey: input.idempotencyKey, ipAddress: meta.ip },
      creditTransaction: { accountId: recipient.id, userId: recipient.userId, description: input.description || 'Transfer received' },
      debitTxType: 'TRANSFER_OUT',
      creditTxType: 'TRANSFER_IN',
    });
    const updated = await tx.transfer.update({ where: { id: transfer.id }, data: { status: 'completed', completedAt: new Date() } });
    await tx.notification.createMany({ data: [
      { userId, type: 'TRANSFER_COMPLETED', title: 'Transfer completed', message: `Your transfer of $${amount.toFixed(2)} to account ending ${recipient.accountNumber.slice(-4)} was completed.` },
      { userId: recipient.userId, type: 'TRANSFER_RECEIVED', title: 'Money received', message: `You received $${amount.toFixed(2)} from a Crestline Capital account.` },
    ] });
    return { transfer: updated, journalId: posted.journalId, replayed: false };
  });
  if (!result.replayed) await logAudit({ actorId: userId, actorType: 'user', action: 'transfer.completed', entityType: 'transfer', entityId: result.transfer.id, ipAddress: meta.ip, userAgent: meta.ua });
  return result;
}

export async function createDeposit(userId: string, input: { accountId: string; amount: string; description?: string; idempotencyKey: string }) {
  const existing = await prisma.deposit.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) { if (existing.userId !== userId) throw new Error('Invalid idempotency key'); return { deposit: existing, replayed: true }; }
  const amount = money(input.amount);
  if (amount.lte(0)) throw new Error('Amount must be greater than zero');
  const account = await prisma.account.findFirst({ where: { id: input.accountId, userId } });
  if (!account) throw new Error('Account not found');
  if (account.status !== 'active') throw new Error('Account is not active');
  const deposit = await prisma.deposit.create({ data: { accountId: account.id, userId, amount, currency: account.currency, reference: ref('DEP'), status: 'pending', description: input.description, idempotencyKey: input.idempotencyKey } });
  await prisma.notification.create({ data: { userId, type: 'DEPOSIT_SUBMITTED', title: 'Deposit submitted', message: `Your $${amount.toFixed(2)} deposit request is pending review.` } });
  await logAudit({ actorId: userId, actorType: 'user', action: 'deposit.created', entityType: 'deposit', entityId: deposit.id });
  return { deposit, replayed: false };
}

export async function approveDeposit(adminId: string, depositId: string, reason?: string) {
  const result = await serializableTransaction(async (tx) => {
    const deposit = await tx.deposit.findUnique({ where: { id: depositId } });
    if (!deposit) throw new Error('Deposit not found');
    if (deposit.status === 'completed') return deposit;
    if (deposit.status !== 'pending') throw new Error('Deposit is no longer pending');
    const account = await tx.account.findUnique({ where: { id: deposit.accountId } });
    if (!account || account.status !== 'active') throw new Error('Account is not active');
    const clearing = await tx.account.findFirst({ where: { accountType: 'CLEARING', currency: deposit.currency, status: 'active' } });
    if (!clearing || clearing.id === account.id) throw new Error('Deposit clearing account is not configured');

    await postJournal(tx, {
      reference: deposit.reference,
      currency: deposit.currency,
      amount: deposit.amount,
      debitAccountId: clearing.id,
      creditAccountId: account.id,
      movementType: 'DEPOSIT',
      movementId: deposit.id,
      debitTransaction: { accountId: clearing.id, userId: clearing.userId, description: 'Deposit funding / clearing' },
      creditTransaction: { accountId: account.id, userId: deposit.userId, description: deposit.description || 'Deposit' },
      debitTxType: 'DEBIT',
      creditTxType: 'DEPOSIT',
    });
    const updated = await tx.deposit.update({ where: { id: deposit.id }, data: { status: 'completed', completedAt: new Date() } });
    await tx.notification.create({ data: { userId: deposit.userId, type: 'DEPOSIT_COMPLETED', title: 'Deposit completed', message: `Your $${deposit.amount.toFixed(2)} deposit was approved.` } });
    return updated;
  });
  await logAudit({ actorId: adminId, actorType: 'admin', action: 'deposit.approve', entityType: 'deposit', entityId: depositId, changes: reason ? { reason } : undefined });
  return result;
}

export async function rejectDeposit(adminId: string, depositId: string, reason?: string) {
  const result = await serializableTransaction(async (tx) => {
    const deposit = await tx.deposit.findUnique({ where: { id: depositId } });
    if (!deposit) throw new Error('Deposit not found');
    if (deposit.status === 'rejected') return deposit;
    if (deposit.status !== 'pending') throw new Error('Deposit is no longer pending');
    const updated = await tx.deposit.update({ where: { id: depositId }, data: { status: 'rejected' } });
    await tx.notification.create({ data: { userId: deposit.userId, type: 'DEPOSIT_REJECTED', title: 'Deposit rejected', message: reason ? `Your deposit was rejected: ${reason}` : 'Your deposit request was rejected.' } });
    return updated;
  });
  await logAudit({ actorId: adminId, actorType: 'admin', action: 'deposit.reject', entityType: 'deposit', entityId: depositId, changes: reason ? { reason } : undefined });
  return result;
}

export async function createWithdrawal(userId: string, input: { accountId: string; amount: string; destination: string; description?: string; idempotencyKey: string }) {
  const existing = await prisma.withdrawal.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) { if (existing.userId !== userId) throw new Error('Invalid idempotency key'); return { withdrawal: existing, replayed: true }; }
  const amount = money(input.amount);
  if (amount.lte(0)) throw new Error('Amount must be greater than zero');
  const account = await prisma.account.findFirst({ where: { id: input.accountId, userId } });
  if (!account) throw new Error('Account not found');
  if (account.status !== 'active') throw new Error('Account is not active');
  const withdrawal = await prisma.withdrawal.create({ data: { accountId: account.id, userId, amount, currency: account.currency, destination: input.destination, reference: ref('WDR'), status: 'pending', description: input.description, idempotencyKey: input.idempotencyKey } });
  await prisma.notification.create({ data: { userId, type: 'WITHDRAWAL_SUBMITTED', title: 'Withdrawal submitted', message: `Your $${amount.toFixed(2)} withdrawal request is pending approval.` } });
  await logAudit({ actorId: userId, actorType: 'user', action: 'withdrawal.created', entityType: 'withdrawal', entityId: withdrawal.id });
  return { withdrawal, replayed: false };
}

export async function approveWithdrawal(adminId: string, withdrawalId: string, reason?: string) {
  const result = await serializableTransaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new Error('Withdrawal not found');
    if (withdrawal.status === 'completed') return withdrawal;
    if (withdrawal.status !== 'pending') throw new Error('Withdrawal is no longer pending');
    const account = await tx.account.findUnique({ where: { id: withdrawal.accountId } });
    if (!account || account.status !== 'active') throw new Error('Account is not active');
    const clearing = await tx.account.findFirst({ where: { accountType: 'CLEARING', currency: withdrawal.currency, status: 'active' } });
    if (!clearing || clearing.id === account.id) throw new Error('Withdrawal clearing account is not configured');

    await postJournal(tx, {
      reference: withdrawal.reference,
      currency: withdrawal.currency,
      amount: withdrawal.amount,
      debitAccountId: account.id,
      creditAccountId: clearing.id,
      movementType: 'WITHDRAWAL',
      movementId: withdrawal.id,
      debitTransaction: { accountId: account.id, userId: withdrawal.userId, description: withdrawal.description || 'Withdrawal' },
      creditTransaction: { accountId: clearing.id, userId: clearing.userId, description: 'Withdrawal clearing' },
      debitTxType: 'WITHDRAWAL',
      creditTxType: 'CREDIT',
    });
    const updated = await tx.withdrawal.update({ where: { id: withdrawal.id }, data: { status: 'completed', reviewedAt: new Date(), reviewedBy: adminId } });
    await tx.notification.create({ data: { userId: withdrawal.userId, type: 'WITHDRAWAL_APPROVED', title: 'Withdrawal approved', message: `Your $${withdrawal.amount.toFixed(2)} withdrawal was approved.` } });
    return updated;
  });
  await logAudit({ actorId: adminId, actorType: 'admin', action: 'withdrawal.approve', entityType: 'withdrawal', entityId: withdrawalId, changes: reason ? { reason } : undefined });
  return result;
}

export async function rejectWithdrawal(adminId: string, withdrawalId: string, reason?: string) {
  const result = await serializableTransaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new Error('Withdrawal not found');
    if (withdrawal.status === 'rejected') return withdrawal;
    if (withdrawal.status !== 'pending') throw new Error('Withdrawal is no longer pending');
    const updated = await tx.withdrawal.update({ where: { id: withdrawalId }, data: { status: 'rejected', reviewedAt: new Date(), reviewedBy: adminId } });
    await tx.notification.create({ data: { userId: withdrawal.userId, type: 'WITHDRAWAL_REJECTED', title: 'Withdrawal rejected', message: reason ? `Your withdrawal was rejected: ${reason}` : 'Your withdrawal request was rejected.' } });
    return updated;
  });
  await logAudit({ actorId: adminId, actorType: 'admin', action: 'withdrawal.reject', entityType: 'withdrawal', entityId: withdrawalId, changes: reason ? { reason } : undefined });
  return result;
}
