import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const banking = fs.readFileSync('src/lib/banking.ts', 'utf8');
const adminWithdrawal = fs.readFileSync('src/app/api/v1/admin/withdrawals/[id]/route.ts', 'utf8');
const auth = fs.readFileSync('src/lib/auth.ts', 'utf8');
const middleware = fs.readFileSync('src/middleware.ts', 'utf8');


test('financial service uses one serializable database transaction and idempotency', () => {
  assert.match(banking, /prisma\.\$transaction/);
  assert.match(banking, /TransactionIsolationLevel\.Serializable/);
  assert.match(banking, /findUnique\(\{ where: \{ idempotencyKey:/);
  assert.match(banking, /idempotencyKey/);
});

test('authoritative posting uses conditional balance protection', () => {
  assert.match(banking, /availableBalance: \{ gte: input\.amount \}/);
  assert.match(banking, /balance: \{ decrement: input\.amount \}/);
  assert.match(banking, /balance: \{ increment: input\.amount \}/);
  assert.match(adminWithdrawal, /approveWithdrawal/);
  assert.doesNotMatch(adminWithdrawal, /\.account\.(update|updateMany)/);
});

test('financial movements are journal-backed with two persisted ledger sides', () => {
  assert.match(banking, /postJournal\(/);
  assert.match(banking, /financial_journals/);
  assert.match(banking, /ledger_entries/);
  assert.match(banking, /'DEBIT'/);
  assert.match(banking, /'CREDIT'/);
  assert.match(banking, /journal_id/);
});

test('production authentication refuses missing weak JWT secrets', () => {
  assert.match(auth, /NODE_ENV === 'production'/);
  assert.match(auth, /accessSecretValue\.length < 32/);
  assert.match(auth, /refreshSecretValue\.length < 32/);
});

test('middleware derives request identity from the signed access-token cookie', () => {
  assert.match(middleware, /request\.cookies\.get\('access_token'\)/);
  assert.match(middleware, /verifyAccessToken/);
  assert.match(middleware, /requestHeaders\.set\('x-user-id', payload\.sub\)/);
});

test('financial hardening migration is committed', () => {
  assert.equal(fs.existsSync('prisma/migrations/0003_financial_journal_hardening/migration.sql'), true);
});
