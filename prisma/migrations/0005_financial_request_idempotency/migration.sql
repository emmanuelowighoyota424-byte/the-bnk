ALTER TABLE "deposits" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "deposits_idempotency_key_key" ON "deposits"("idempotency_key");
ALTER TABLE "withdrawals" ADD COLUMN "idempotency_key" TEXT;
CREATE UNIQUE INDEX "withdrawals_idempotency_key_key" ON "withdrawals"("idempotency_key");
