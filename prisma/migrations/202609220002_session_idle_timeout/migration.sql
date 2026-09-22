ALTER TABLE "user_sessions" ADD COLUMN "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "user_sessions_last_activity_at_idx" ON "user_sessions"("last_activity_at");
