CREATE TABLE IF NOT EXISTS "financial_journals" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "total_debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "total_credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "idempotency_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "posted_at" TIMESTAMP(3),
  CONSTRAINT "financial_journals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_journals_reference_key" UNIQUE ("reference"),
  CONSTRAINT "financial_journals_idempotency_key_key" UNIQUE ("idempotency_key"),
  CONSTRAINT "financial_journals_balanced_check" CHECK ("total_debit" = "total_credit"),
  CONSTRAINT "financial_journals_posted_check" CHECK ("status" <> 'POSTED' OR "posted_at" IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS "financial_journals_status_created_at_idx" ON "financial_journals"("status", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_journal_id_fkey'
  ) THEN
    ALTER TABLE "transactions"
      ADD CONSTRAINT "transactions_journal_id_fkey"
      FOREIGN KEY ("journal_id") REFERENCES "financial_journals"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
