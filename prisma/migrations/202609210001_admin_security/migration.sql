-- Crestline Capital V2 admin security migration
CREATE TABLE "admin_sessions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "admin_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL UNIQUE,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  CONSTRAINT "admin_sessions_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "admin_sessions_admin_id_expires_at_idx" ON "admin_sessions"("admin_id","expires_at");
CREATE TABLE "admin_login_attempts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "succeeded" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "admin_login_attempts_ip_address_created_at_idx" ON "admin_login_attempts"("ip_address","created_at");
