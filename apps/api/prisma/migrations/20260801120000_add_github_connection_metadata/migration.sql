-- AlterTable
ALTER TABLE "users" ADD COLUMN "githubUserId" INTEGER,
ADD COLUMN "githubUsername" TEXT,
ADD COLUMN "githubAvatar" TEXT,
ADD COLUMN "githubConnectedAt" TIMESTAMP(3);
