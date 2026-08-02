-- CreateEnum
CREATE TYPE "RepoIndexStatus" AS ENUM ('NOT_INDEXED', 'INDEXING', 'READY', 'FAILED', 'OUTDATED');

-- CreateTable
CREATE TABLE "repository_indexes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "status" "RepoIndexStatus" NOT NULL DEFAULT 'NOT_INDEXED',
    "indexedAt" TIMESTAMP(3),
    "tree" JSONB NOT NULL,
    "fileMetadata" JSONB NOT NULL,
    "languageBreakdown" JSONB NOT NULL,
    "stats" JSONB NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repository_indexes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "repository_indexes_userId_owner_repo_idx" ON "repository_indexes"("userId", "owner", "repo");

-- CreateIndex
CREATE INDEX "repository_indexes_status_idx" ON "repository_indexes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "repository_indexes_userId_owner_repo_branch_key" ON "repository_indexes"("userId", "owner", "repo", "branch");

-- AddForeignKey
ALTER TABLE "repository_indexes" ADD CONSTRAINT "repository_indexes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
