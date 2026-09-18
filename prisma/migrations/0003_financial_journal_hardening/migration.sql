-- Harden financial journals into immutable, movement-addressable double-entry postings.

ALTER TABLE "financial_journals"
  ADD COLUMN IF NOT EXISTS "source_type" TEXT,
  ADD COLUMN IF NOT EXISTS "source_id" TEXT;

-- Preserve already-posted journals created before source identity existed.
UPDATE "financial_journals"
SET "source_type" = 'LEGACY', "source_id" = "id"
WHERE "source_type" IS NULL OR "source_id" IS NULL;

ALTER TABLE "financial_journals"
  ALTER COLUMN "source_type" SET NOT NULL,
  ALTER COLUMN "source_id" SET NOT NULL;

ALTER TABLE "financial_journals"
  DROP CONSTRAINT IF EXISTS "financial_journals_source_pair_check";
ALTER TABLE "financial_journals"
  ADD CONSTRAINT "financial_journals_source_pair_check"
  CHECK ("source_type" IN ('TRANSFER', 'DEPOSIT', 'WITHDRAWAL', 'LEGACY'));

CREATE UNIQUE INDEX IF NOT EXISTS "financial_journals_source_type_source_id_key"
  ON "financial_journals"("source_type", "source_id");

ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "journal_id" TEXT;

-- Existing entries that were already linked to a journal inherit that relationship.
UPDATE "ledger_entries" le
SET "journal_id" = t."journal_id"
FROM "transactions" t
WHERE le."transaction_id" = t."id"
  AND le."journal_id" IS NULL
  AND t."journal_id" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_journal_id_fkey'
  ) THEN
    ALTER TABLE "ledger_entries"
      ADD CONSTRAINT "ledger_entries_journal_id_fkey"
      FOREIGN KEY ("journal_id") REFERENCES "financial_journals"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ledger_entries_journal_id_idx"
  ON "ledger_entries"("journal_id");

ALTER TABLE "ledger_entries"
  DROP CONSTRAINT IF EXISTS "ledger_entries_direction_check";
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_direction_check"
  CHECK ("direction" IN ('DEBIT', 'CREDIT'));

ALTER TABLE "ledger_entries"
  DROP CONSTRAINT IF EXISTS "ledger_entries_amount_positive_check";
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_amount_positive_check"
  CHECK ("amount" > 0);

-- A posted journal must identify a real movement. Legacy journals are explicitly
-- marked during this migration and remain immutable historical records.
CREATE OR REPLACE FUNCTION "validate_posted_financial_journal"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_debits DECIMAL(18,2);
  v_credits DECIMAL(18,2);
  v_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "financial_journals" WHERE "id" = NEW."id" AND "status" = 'POSTED') THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*),
         COALESCE(SUM(CASE WHEN "direction" = 'DEBIT' THEN "amount" ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN "direction" = 'CREDIT' THEN "amount" ELSE 0 END), 0)
  INTO v_count, v_debits, v_credits
  FROM "ledger_entries"
  WHERE "journal_id" = NEW."id";

  IF v_count <> 2 OR v_debits <> v_credits OR v_debits <> NEW."total_debit" OR v_credits <> NEW."total_credit" THEN
    RAISE EXCEPTION 'Posted journal % must contain exactly two balanced entries', NEW."id";
  END IF;

  IF NEW."source_type" = 'TRANSFER' AND NOT EXISTS (SELECT 1 FROM "transfers" WHERE "id" = NEW."source_id") THEN
    RAISE EXCEPTION 'Posted transfer journal % references missing transfer %', NEW."id", NEW."source_id";
  ELSIF NEW."source_type" = 'DEPOSIT' AND NOT EXISTS (SELECT 1 FROM "deposits" WHERE "id" = NEW."source_id") THEN
    RAISE EXCEPTION 'Posted deposit journal % references missing deposit %', NEW."id", NEW."source_id";
  ELSIF NEW."source_type" = 'WITHDRAWAL' AND NOT EXISTS (SELECT 1 FROM "withdrawals" WHERE "id" = NEW."source_id") THEN
    RAISE EXCEPTION 'Posted withdrawal journal % references missing withdrawal %', NEW."id", NEW."source_id";
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION "protect_financial_journal"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'POSTED' THEN
      RAISE EXCEPTION 'Posted financial journals are immutable';
    END IF;
    RETURN OLD;
  END IF;

  IF OLD."status" = 'POSTED' THEN
    RAISE EXCEPTION 'Posted financial journals are immutable';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."reference" IS DISTINCT FROM OLD."reference"
     OR NEW."currency" IS DISTINCT FROM OLD."currency"
     OR NEW."total_debit" IS DISTINCT FROM OLD."total_debit"
     OR NEW."total_credit" IS DISTINCT FROM OLD."total_credit"
     OR NEW."idempotency_key" IS DISTINCT FROM OLD."idempotency_key"
     OR NEW."source_type" IS DISTINCT FROM OLD."source_type"
     OR NEW."source_id" IS DISTINCT FROM OLD."source_id"
     OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'Financial journal fields are immutable after creation';
  END IF;

  IF NEW."status" <> 'POSTED' OR NEW."posted_at" IS NULL THEN
    RAISE EXCEPTION 'Financial journals may only transition PENDING -> POSTED with posted_at';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "protect_ledger_entry"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."journal_id" IS NULL THEN
      RAISE EXCEPTION 'Ledger entries must belong to a financial journal';
    END IF;
    SELECT "status" INTO v_status FROM "financial_journals" WHERE "id" = NEW."journal_id";
    IF v_status IS NULL THEN
      RAISE EXCEPTION 'Ledger entry references missing journal %', NEW."journal_id";
    END IF;
    IF v_status = 'POSTED' THEN
      RAISE EXCEPTION 'Cannot append entries to a posted journal';
    END IF;
    RETURN NEW;
  END IF;

  SELECT "status" INTO v_status FROM "financial_journals" WHERE "id" = OLD."journal_id";
  IF v_status = 'POSTED' THEN
    RAISE EXCEPTION 'Posted ledger entries are immutable';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Ledger entries are immutable';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "financial_journal_immutable" ON "financial_journals";
CREATE TRIGGER "financial_journal_immutable"
BEFORE UPDATE OR DELETE ON "financial_journals"
FOR EACH ROW EXECUTE FUNCTION "protect_financial_journal"();

DROP TRIGGER IF EXISTS "ledger_entry_immutable" ON "ledger_entries";
CREATE TRIGGER "ledger_entry_immutable"
BEFORE INSERT OR UPDATE OR DELETE ON "ledger_entries"
FOR EACH ROW EXECUTE FUNCTION "protect_ledger_entry"();

DROP TRIGGER IF EXISTS "financial_journal_balance_constraint" ON "financial_journals";
CREATE CONSTRAINT TRIGGER "financial_journal_balance_constraint"
AFTER INSERT OR UPDATE OF "status" ON "financial_journals"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validate_posted_financial_journal"();

DROP TRIGGER IF EXISTS "ledger_entry_balance_constraint" ON "ledger_entries";
CREATE CONSTRAINT TRIGGER "ledger_entry_balance_constraint"
AFTER INSERT OR UPDATE OR DELETE ON "ledger_entries"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "validate_posted_financial_journal"();
