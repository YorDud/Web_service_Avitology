-- AlterTable
ALTER TABLE "AvitoAccountConnection" ADD COLUMN "accessTokenEnc" TEXT;

-- CreateTable
CREATE TABLE "AutoloadFeed" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "linked" BOOLEAN NOT NULL DEFAULT false,
    "defaults" JSONB,
    "settings" JSONB,
    "lastFetchedAt" DATETIME,
    "fetchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AutoloadFeed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AutoloadAd" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "feedId" INTEGER NOT NULL,
    "adKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "avitoId" TEXT,
    "avitoStatus" TEXT,
    "avitoMessages" JSONB,
    "syncedAt" DATETIME,
    CONSTRAINT "AutoloadAd_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "AutoloadFeed" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "AutoloadFeed_publicToken_key" ON "AutoloadFeed"("publicToken");

-- CreateIndex
CREATE INDEX "AutoloadFeed_userId_idx" ON "AutoloadFeed"("userId");

-- CreateIndex
CREATE INDEX "AutoloadAd_feedId_idx" ON "AutoloadAd"("feedId");

-- CreateIndex
CREATE UNIQUE INDEX "AutoloadAd_feedId_adKey_key" ON "AutoloadAd"("feedId", "adKey");

