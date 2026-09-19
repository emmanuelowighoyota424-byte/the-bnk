ALTER TABLE "users" ADD COLUMN "transfer_blocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "transfer_block_message" TEXT;
ALTER TABLE "users" ADD COLUMN "withdrawal_blocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "withdrawal_block_message" TEXT;

CREATE TABLE "transaction_verification_codes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "transaction_verification_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "transaction_verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "transaction_verification_codes_user_id_type_created_at_idx" ON "transaction_verification_codes"("user_id","type","created_at");

-- Provision the internal clearing account used for controlled administrative balance adjustments.
INSERT INTO "users" ("id","email","password_hash","bnk_tag","first_name","last_name","status","kyc_status","kyc_tier","updated_at")
VALUES ('system-clearing-user','system-clearing@crestline.invalid','!disabled!','crestline-clearing','Crestline','Clearing','suspended','verified',3,CURRENT_TIMESTAMP)
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "accounts" ("id","user_id","account_type","account_number","routing_number","balance","available_balance","currency","status")
SELECT 'system-clearing-account','system-clearing-user','CLEARING','999999999998','000000000',0,0,'USD','active'
WHERE EXISTS (SELECT 1 FROM "users" WHERE "id"='system-clearing-user')
  AND NOT EXISTS (SELECT 1 FROM "accounts" WHERE "id"='system-clearing-account');
