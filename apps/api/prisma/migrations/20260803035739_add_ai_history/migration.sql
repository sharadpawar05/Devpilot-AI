-- CreateEnum
CREATE TYPE "WorkflowType" AS ENUM ('PLAYGROUND', 'CODE_REVIEW', 'PR_REVIEW', 'PR_ANALYSIS', 'REPOSITORY_CHAT', 'DOCUMENTATION', 'TEST_GENERATION', 'SECURITY_REVIEW', 'ARCHITECTURE_REVIEW');

-- CreateTable
CREATE TABLE "ai_history_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "workflowType" "WorkflowType" NOT NULL,
    "repository" TEXT,
    "title" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "totalLatency" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_history_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_history_messages" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "latency" INTEGER NOT NULL DEFAULT 0,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_history_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_history_sessions_userId_createdAt_idx" ON "ai_history_sessions"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ai_history_sessions_userId_workflowType_idx" ON "ai_history_sessions"("userId", "workflowType");

-- CreateIndex
CREATE INDEX "ai_history_sessions_userId_pinned_idx" ON "ai_history_sessions"("userId", "pinned");

-- CreateIndex
CREATE INDEX "ai_history_sessions_userId_favorite_idx" ON "ai_history_sessions"("userId", "favorite");

-- CreateIndex
CREATE INDEX "ai_history_messages_sessionId_createdAt_idx" ON "ai_history_messages"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ai_history_sessions" ADD CONSTRAINT "ai_history_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_history_messages" ADD CONSTRAINT "ai_history_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ai_history_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
