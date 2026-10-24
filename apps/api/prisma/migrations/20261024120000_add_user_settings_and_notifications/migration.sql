-- CreateTable: per-user persisted settings (profile/ai/github/appearance/notifications)
CREATE TABLE "user_settings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultProvider" TEXT NOT NULL DEFAULT 'gemini',
    "defaultModel" TEXT NOT NULL DEFAULT 'gemini-3.6-flash',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 4096,
    "streamResponses" BOOLEAN NOT NULL DEFAULT true,
    "markdownOutput" BOOLEAN NOT NULL DEFAULT true,
    "autoScroll" BOOLEAN NOT NULL DEFAULT true,
    "autoCopy" BOOLEAN NOT NULL DEFAULT false,
    "defaultReviewType" TEXT NOT NULL DEFAULT 'standard',
    "defaultReviewDepth" TEXT NOT NULL DEFAULT 'moderate',
    "defaultRepository" TEXT,
    "defaultBranch" TEXT DEFAULT 'main',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "compactMode" BOOLEAN NOT NULL DEFAULT false,
    "fontSize" TEXT NOT NULL DEFAULT 'default',
    "accentColor" TEXT NOT NULL DEFAULT 'blue',
    "notifyReviewComplete" BOOLEAN NOT NULL DEFAULT true,
    "notifyPrAnalysis" BOOLEAN NOT NULL DEFAULT true,
    "notifyRepositorySync" BOOLEAN NOT NULL DEFAULT false,
    "notifyGithubAlerts" BOOLEAN NOT NULL DEFAULT true,
    "notifyWeeklySummary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: in-app notifications (replaces the mocked bell feed)
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "user_settings"("userId");

-- CreateIndex
CREATE INDEX "notifications_userId_read_createdAt_idx" ON "notifications"("userId", "read", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
