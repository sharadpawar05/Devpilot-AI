-- CreateTable
CREATE TABLE "repo_health_snapshots" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "passedCount" INTEGER NOT NULL,
    "failedCount" INTEGER NOT NULL,
    "criticalCount" INTEGER NOT NULL,
    "structuralScore" INTEGER NOT NULL,
    "qualityScore" INTEGER NOT NULL,
    "details" JSONB NOT NULL,
    "scoreBreakdown" JSONB NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repo_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_usage" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "healthScanCount" INTEGER NOT NULL DEFAULT 0,
    "aiReportCount" INTEGER NOT NULL DEFAULT 0,
    "aiChatCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "repo_health_snapshots_userId_owner_repo_idx" ON "repo_health_snapshots"("userId", "owner", "repo");

-- CreateIndex
CREATE INDEX "repo_health_snapshots_userId_createdAt_idx" ON "repo_health_snapshots"("userId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "repo_health_snapshots_userId_owner_repo_commitSha_key" ON "repo_health_snapshots"("userId", "owner", "repo", "commitSha");

-- CreateIndex
CREATE INDEX "user_usage_userId_idx" ON "user_usage"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_usage_userId_period_key" ON "user_usage"("userId", "period");

-- AddForeignKey
ALTER TABLE "repo_health_snapshots" ADD CONSTRAINT "repo_health_snapshots_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_usage" ADD CONSTRAINT "user_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
