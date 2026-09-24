-- AlterTable: redesign user_usage for period-based quotas while preserving existing data.

-- Add nullable columns first so existing rows can be backfilled.
ALTER TABLE "user_usage" ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP(3);
ALTER TABLE "user_usage" ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMP(3);
ALTER TABLE "user_usage" ADD COLUMN IF NOT EXISTS "aiCreditsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user_usage" ADD COLUMN IF NOT EXISTS "healthScansUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user_usage" ADD COLUMN IF NOT EXISTS "aiReportsUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "user_usage" ADD COLUMN IF NOT EXISTS "chatMessagesUsed" INTEGER NOT NULL DEFAULT 0;

-- Backfill periodStart/periodEnd from legacy "YYYY-MM" period string.
UPDATE "user_usage"
SET
  "periodStart" = (TO_DATE("period", 'YYYY-MM')::timestamp),
  "periodEnd" = (TO_DATE("period", 'YYYY-MM')::timestamp + INTERVAL '1 month'),
  "healthScansUsed" = "healthScanCount",
  "aiReportsUsed" = "aiReportCount",
  "chatMessagesUsed" = "aiChatCount"
WHERE "periodStart" IS NULL;

-- Drop legacy unique index on (userId, period).
DROP INDEX IF EXISTS "user_usage_userId_period_key";

-- Drop legacy columns.
ALTER TABLE "user_usage" DROP COLUMN IF EXISTS "period";
ALTER TABLE "user_usage" DROP COLUMN IF EXISTS "healthScanCount";
ALTER TABLE "user_usage" DROP COLUMN IF EXISTS "aiReportCount";
ALTER TABLE "user_usage" DROP COLUMN IF EXISTS "aiChatCount";

-- Make period columns required now that backfill is done.
ALTER TABLE "user_usage" ALTER COLUMN "periodStart" SET NOT NULL;
ALTER TABLE "user_usage" ALTER COLUMN "periodEnd" SET NOT NULL;

-- Recreate unique constraint on (userId, periodStart).
CREATE UNIQUE INDEX "user_usage_userId_periodStart_key" ON "user_usage"("userId", "periodStart");

-- CreateTable
CREATE TABLE "ai_usage_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "feature" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "creditsConsumed" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_events_userId_createdAt_idx" ON "ai_usage_events"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ai_usage_events_feature_idx" ON "ai_usage_events"("feature");

-- AddForeignKey
ALTER TABLE "ai_usage_events" ADD CONSTRAINT "ai_usage_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
