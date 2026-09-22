CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "auth_challenges" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "challenge_hash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_challenges_challenge_hash_key" UNIQUE ("challenge_hash"),
  CONSTRAINT "auth_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "auth_challenges_user_id_purpose_consumed_at_expires_at_idx" ON "auth_challenges"("user_id","purpose","consumed_at","expires_at");
CREATE INDEX "auth_challenges_expires_at_idx" ON "auth_challenges"("expires_at");

CREATE TABLE "auth_rate_limits" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "reset_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_rate_limits_key_key" UNIQUE ("key")
);
CREATE INDEX "auth_rate_limits_reset_at_idx" ON "auth_rate_limits"("reset_at");
