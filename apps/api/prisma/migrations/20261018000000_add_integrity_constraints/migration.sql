-- Integrity constraints (audit/database-integrity):
-- 1. Enforce that an AI report's project belongs to the report's organization.
-- 2. Enforce non-negative usage counters (NOT VALID: never validates or alters existing rows).
-- 3. Drop redundant indexes fully covered by a unique index on the same columns/prefix.

-- DropForeignKey
ALTER TABLE "ai_reports" DROP CONSTRAINT "ai_reports_projectId_fkey";

-- DropIndex
DROP INDEX "organizations_slug_idx";

-- DropIndex
DROP INDEX "repo_health_snapshots_userId_owner_repo_idx";

-- DropIndex
DROP INDEX "repository_indexes_userId_owner_repo_idx";

-- DropIndex
DROP INDEX "user_usage_userId_idx";

-- DropIndex
DROP INDEX "users_email_idx";

-- DropIndex
DROP INDEX "users_supabaseUserId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "projects_id_organizationId_key" ON "projects"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_projectId_organizationId_fkey" FOREIGN KEY ("projectId", "organizationId") REFERENCES "projects"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheck (raw SQL; invisible to Prisma's diff engine, so no future drift)
ALTER TABLE "user_usage" ADD CONSTRAINT "user_usage_counters_non_negative"
  CHECK ("aiCreditsUsed" >= 0 AND "healthScansUsed" >= 0 AND "aiReportsUsed" >= 0 AND "chatMessagesUsed" >= 0)
  NOT VALID;
