import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { approveDeposit, approveWithdrawal, createDeposit, createWithdrawal, transferFunds } from '../src/lib/banking';

const PREFIX = `ledger_ci_${Date.now()}_`;
const users: string[] = [];
const transferIds: string[] = [];

async function createUser(label: string) {
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}${label}@example.test`,
      passwordHash: 'test-only',
      firstName: label,
      lastName: 'Ledger',
      status: 'active',
    },
  });
  users.push(user.id);
  return user;
}

async function createAccount(userId: string, label: string, balance: string, accountType = 'CHECKING') {
  return prisma.account.create({
    data: {
      userId,
      accountType,
      accountNumber: `${Date.now()}${Math.random().toString().slice(2, 10)}`.slice(0, 16),
      balance: new Prisma.Decimal(balance),
      availableBalance: new Prisma.Decimal(balance),
      currency: 'USD',
      status: 'active',
    },
  });
}

async function journalFor(sourceType: string, sourceId: string) {
  const rows = await prisma.$queryRaw<Array<{
    id: string;
    reference: string;
    status: string;
    source_type: string;
    source_id: string;
    total_debit: Prisma.Decimal;
    total_credit: Prisma.Decimal;
    entry_count: bigint;
    debit_sum: Prisma.Decimal;
    credit_sum: Prisma.Decimal;
  }>>`
    SELECT j."id", j."reference", j."status", j."source_type", j."source_id",
           j."total_debit", j."total_credit",
           COUNT(le."id") AS "entry_count",
           COALESCE(SUM(CASE WHEN le."direction" = 'DEBIT' THEN le."amount" ELSE 0 END), 0) AS "debit_sum",
           COALESCE(SUM(CASE WHEN le."direction" = 'CREDIT' THEN le."amount" ELSE 0 END), 0) AS "credit_sum"
    FROM "financial_journals" j
    LEFT JOIN "ledger_entries" le ON le."journal_id" = j."id"
    WHERE j."source_type" = ${sourceType} AND j."source_id" = ${sourceId}
    GROUP BY j."id"
  `;
  return rows[0];
}

async function assertBalancedJournal(sourceType: string, sourceId: string, amount: string) {
  const journal = await journalFor(sourceType, sourceId);
  assert.ok(journal, `missing ${sourceType} journal`);
  assert.equal(journal.status, 'POSTED');
  assert.equal(journal.entry_count, 2n);
  assert.equal(journal.debit_sum.toString(), amount);
  assert.equal(journal.credit_sum.toString(), amount);
  assert.equal(journal.total_debit.toString(), amount);
  assert.equal(journal.total_credit.toString(), amount);
  return journal;
}

before(async () => {
  await prisma.$queryRaw`SELECT 1`;
});

after(async () => {
  const testUserIds = [...users];
  await prisma.user.deleteMany({ where: { id: { in: testUserIds } } });
  if (transferIds.length) await prisma.transfer.deleteMany({ where: { id: { in: transferIds } } });
  await prisma.$executeRaw`DELETE FROM "financial_journals" WHERE "source_type" IN ('TRANSFER','DEPOSIT','WITHDRAWAL') AND "source_id" LIKE ${PREFIX + '%'}`;
  await prisma.$disconnect();
});

test('persisted transfer is exactly one balanced journal with two entries', async () => {
  const senderUser = await createUser('transfer_sender');
  const receiverUser = await createUser('transfer_receiver');
  const sender = await createAccount(senderUser.id, 'sender', '1000.00');
  const receiver = await createAccount(receiverUser.id, 'receiver', '50.00');

  const result = await transferFunds(senderUser.id, {
    senderAccountId: sender.id,
    recipientAccountNumber: receiver.accountNumber,
    amount: '100.00',
    description: 'Postgres transfer',
    idempotencyKey: `${PREFIX}transfer-key`,
  }, {});
  transferIds.push(result.transfer.id);

  const [senderReloaded, receiverReloaded, transactions] = await Promise.all([
    prisma.account.findUniqueOrThrow({ where: { id: sender.id } }),
    prisma.account.findUniqueOrThrow({ where: { id: receiver.id } }),
    prisma.transaction.findMany({ where: { journalId: result.journalId }, orderBy: { createdAt: 'asc' } }),
  ]);
  assert.equal(senderReloaded.balance.toString(), '900');
  assert.equal(receiverReloaded.balance.toString(), '150');
  assert.equal(transactions.length, 2);
  assert.ok(transactions.every((row) => row.journalId === result.journalId));
  await assertBalancedJournal('TRANSFER', result.transfer.id, '100.00');
});

test('approved deposit debits clearing and credits customer atomically', async () => {
  const systemUser = await createUser('deposit_clearing');
  const customer = await createUser('deposit_customer');
  const clearing = await createAccount(systemUser.id, 'clearing', '1000.00', 'CLEARING');
  const account = await createAccount(customer.id, 'deposit_account', '0.00');
  const deposit = await createDeposit(customer.id, { accountId: account.id, amount: '100.00', description: 'Funding' });

  await approveDeposit(systemUser.id, deposit.id);

  const [customerReloaded, clearingReloaded, persistedDeposit] = await Promise.all([
    prisma.account.findUniqueOrThrow({ where: { id: account.id } }),
    prisma.account.findUniqueOrThrow({ where: { id: clearing.id } }),
    prisma.deposit.findUniqueOrThrow({ where: { id: deposit.id } }),
  ]);
  assert.equal(persistedDeposit.status, 'completed');
  assert.equal(customerReloaded.balance.toString(), '100');
  assert.equal(clearingReloaded.balance.toString(), '900');
  await assertBalancedJournal('DEPOSIT', deposit.id, '100.00');
});

test('approved withdrawal debits customer and credits clearing through journal workflow', async () => {
  const systemUser = await createUser('withdrawal_clearing');
  const customer = await createUser('withdrawal_customer');
  const clearing = await createAccount(systemUser.id, 'withdrawal_clearing', '0.00', 'CLEARING');
  const account = await createAccount(customer.id, 'withdrawal_account', '1000.00');
  const withdrawal = await createWithdrawal(customer.id, { accountId: account.id, amount: '125.50', destination: 'Test destination' });

  await approveWithdrawal(systemUser.id, withdrawal.id);

  const [customerReloaded, clearingReloaded, persistedWithdrawal] = await Promise.all([
    prisma.account.findUniqueOrThrow({ where: { id: account.id } }),
    prisma.account.findUniqueOrThrow({ where: { id: clearing.id } }),
    prisma.withdrawal.findUniqueOrThrow({ where: { id: withdrawal.id } }),
  ]);
  assert.equal(persistedWithdrawal.status, 'completed');
  assert.equal(customerReloaded.balance.toString(), '874.5');
  assert.equal(clearingReloaded.balance.toString(), '125.5');
  await assertBalancedJournal('WITHDRAWAL', withdrawal.id, '125.50');
});

test('duplicate approvals are idempotent and create one journal', async () => {
  const systemUser = await createUser('duplicate_system');
  const customer = await createUser('duplicate_customer');
  const clearing = await createAccount(systemUser.id, 'duplicate_clearing', '500.00', 'CLEARING');
  const account = await createAccount(customer.id, 'duplicate_account', '0.00');
  const deposit = await createDeposit(customer.id, { accountId: account.id, amount: '75.00' });

  await approveDeposit(systemUser.id, deposit.id);
  await approveDeposit(systemUser.id, deposit.id);

  const journalCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count FROM "financial_journals" WHERE "source_type" = 'DEPOSIT' AND "source_id" = ${deposit.id}
  `;
  const customerReloaded = await prisma.account.findUniqueOrThrow({ where: { id: account.id } });
  const clearingReloaded = await prisma.account.findUniqueOrThrow({ where: { id: clearing.id } });
  assert.equal(journalCount[0].count, 1n);
  assert.equal(customerReloaded.balance.toString(), '75');
  assert.equal(clearingReloaded.balance.toString(), '425');
});

test('concurrent withdrawal approvals produce one posting', async () => {
  const systemUser = await createUser('concurrent_system');
  const customer = await createUser('concurrent_customer');
  const clearing = await createAccount(systemUser.id, 'concurrent_clearing', '0.00', 'CLEARING');
  const account = await createAccount(customer.id, 'concurrent_account', '300.00');
  const withdrawal = await createWithdrawal(customer.id, { accountId: account.id, amount: '100.00', destination: 'Concurrent destination' });

  const results = await Promise.all([1, 2].map(() => approveWithdrawal(systemUser.id, withdrawal.id)));
  assert.equal(results.length, 2);
  const [persistedWithdrawal, customerReloaded, clearingReloaded] = await Promise.all([
    prisma.withdrawal.findUniqueOrThrow({ where: { id: withdrawal.id } }),
    prisma.account.findUniqueOrThrow({ where: { id: account.id } }),
    prisma.account.findUniqueOrThrow({ where: { id: clearing.id } }),
  ]);
  assert.equal(persistedWithdrawal.status, 'completed');
  assert.equal(customerReloaded.balance.toString(), '200');
  assert.equal(clearingReloaded.balance.toString(), '100');
  const journalCount = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count FROM "financial_journals" WHERE "source_type" = 'WITHDRAWAL' AND "source_id" = ${withdrawal.id}
  `;
  assert.equal(journalCount[0].count, 1n);
  await assertBalancedJournal('WITHDRAWAL', withdrawal.id, '100.00');
});

test('concurrent same-key transfers produce one movement and one journal', async () => {
  const senderUser = await createUser('idempotent_sender');
  const receiverUser = await createUser('idempotent_receiver');
  const sender = await createAccount(senderUser.id, 'idempotent_sender_account', '1000.00');
  const receiver = await createAccount(receiverUser.id, 'idempotent_receiver_account', '0.00');
  const key = `${PREFIX}same-key`;

  const results = await Promise.all([1, 2].map(() => transferFunds(senderUser.id, {
    senderAccountId: sender.id,
    recipientAccountNumber: receiver.accountNumber,
    amount: '250.00',
    idempotencyKey: key,
  }, {})));
  transferIds.push(results[0].transfer.id);

  assert.equal(results[0].transfer.id, results[1].transfer.id);
  const [transfers, journals, senderReloaded, receiverReloaded] = await Promise.all([
    prisma.transfer.findMany({ where: { idempotencyKey: key } }),
    prisma.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM "financial_journals" WHERE "source_type" = 'TRANSFER' AND "source_id" = ${results[0].transfer.id}`,
    prisma.account.findUniqueOrThrow({ where: { id: sender.id } }),
    prisma.account.findUniqueOrThrow({ where: { id: receiver.id } }),
  ]);
  assert.equal(transfers.length, 1);
  assert.equal(journals[0].count, 1n);
  assert.equal(senderReloaded.balance.toString(), '750');
  assert.equal(receiverReloaded.balance.toString(), '250');
  await assertBalancedJournal('TRANSFER', results[0].transfer.id, '250.00');
});

test('two concurrent transfers cannot overspend one account', async () => {
  const senderUser = await createUser('overspend_sender');
  const receiverAUser = await createUser('overspend_receiver_a');
  const receiverBUser = await createUser('overspend_receiver_b');
  const sender = await createAccount(senderUser.id, 'overspend_sender_account', '1000.00');
  const receiverA = await createAccount(receiverAUser.id, 'overspend_receiver_a_account', '0.00');
  const receiverB = await createAccount(receiverBUser.id, 'overspend_receiver_b_account', '0.00');

  const settled = await Promise.allSettled([
    transferFunds(senderUser.id, { senderAccountId: sender.id, recipientAccountNumber: receiverA.accountNumber, amount: '700.00', idempotencyKey: `${PREFIX}overspend-a` }, {}),
    transferFunds(senderUser.id, { senderAccountId: sender.id, recipientAccountNumber: receiverB.accountNumber, amount: '700.00', idempotencyKey: `${PREFIX}overspend-b` }, {}),
  ]);
  const successful = settled.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof transferFunds>>> => r.status === 'fulfilled');
  for (const result of successful) transferIds.push(result.value.transfer.id);

  assert.equal(successful.length, 1);
  const [senderReloaded, receiverAReloaded, receiverBReloaded] = await Promise.all([
    prisma.account.findUniqueOrThrow({ where: { id: sender.id } }),
    prisma.account.findUniqueOrThrow({ where: { id: receiverA.id } }),
    prisma.account.findUniqueOrThrow({ where: { id: receiverB.id } }),
  ]);
  assert.equal(senderReloaded.balance.toString(), '300');
  assert.ok(receiverAReloaded.balance.eq(0) || receiverAReloaded.balance.eq(700));
  assert.ok(receiverBReloaded.balance.eq(0) || receiverBReloaded.balance.eq(700));
  assert.ok(senderReloaded.balance.gte(0));
});

test('all posted test journals are balanced and all journaled entries have parents', async () => {
  const unbalanced = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT j."id"
    FROM "financial_journals" j
    LEFT JOIN "ledger_entries" le ON le."journal_id" = j."id"
    WHERE j."status" = 'POSTED'
    GROUP BY j."id", j."total_debit", j."total_credit"
    HAVING COUNT(le."id") <> 2
       OR COALESCE(SUM(CASE WHEN le."direction" = 'DEBIT' THEN le."amount" ELSE 0 END), 0) <> j."total_debit"
       OR COALESCE(SUM(CASE WHEN le."direction" = 'CREDIT' THEN le."amount" ELSE 0 END), 0) <> j."total_credit"
       OR j."total_debit" <> j."total_credit"
  `;
  assert.equal(unbalanced.length, 0);

  const orphaned = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT le."id" FROM "ledger_entries" le
    LEFT JOIN "financial_journals" j ON j."id" = le."journal_id"
    WHERE le."journal_id" IS NULL OR j."id" IS NULL
    LIMIT 1
  `;
  assert.equal(orphaned.length, 0);
});
