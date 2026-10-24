-- Idempotency key for activity logging: one user action maps to at most one
-- history session per user. Nullable: legacy rows and callers that do not send
-- a key are unaffected (Postgres treats NULLs as distinct in unique indexes).
ALTER TABLE "ai_history_sessions" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;

CREATE UNIQUE INDEX "ai_history_sessions_userId_clientRequestId_key"
  ON "ai_history_sessions"("userId", "clientRequestId");
