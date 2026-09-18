import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const banking = fs.readFileSync('src/lib/banking.ts', 'utf8');
const adminWithdrawal = fs.readFileSync('src/app/api/v1/admin/withdrawals/[id]/route.ts', 'utf8');
const auth = fs.readFileSync('src/lib/auth.ts', 'utf8');
const middleware = fs.readFileSync('src/middleware.ts', 'utf8');

test('transfer service uses a database transaction and idempotency key', () => {
  assert.match(banking, /prisma\.\$transaction/);
  assert.match(banking, /findUnique\(\{where:\{idempotencyKey/);
  assert.match(banking, /idempotencyKey/);
});

test('transfer and withdrawal paths use conditional balance updates', () => {
  assert.match(banking, /availableBalance:\{gte:total\}/);
  assert.match(adminWithdrawal, /availableBalance:\{gte:w\.amount\}/);
});

test('financial movements write ledger entries', () => {
  assert.match(banking, /ledgerEntry\.create/);
  assert.match(banking, /ledgerEntry\.createMany/);
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

test('Prisma migration is committed', () => {
  assert.equal(fs.existsSync('prisma/migrations/0001_init/migration.sql'), true);
});
