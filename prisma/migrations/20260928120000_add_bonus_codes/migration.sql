-- CreateTable
CREATE TABLE "BonusCode" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" DATETIME,
    "validUntil" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BonusCodeRedemption" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codeId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "tier" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "redeemedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BonusCodeRedemption_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "BonusCode" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BonusCodeRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BonusCode_code_key" ON "BonusCode"("code");

-- CreateIndex
CREATE INDEX "BonusCodeRedemption_userId_idx" ON "BonusCodeRedemption"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BonusCodeRedemption_codeId_userId_key" ON "BonusCodeRedemption"("codeId", "userId");

-- Seed: HS3DBASIC = Basic на 3 дня
INSERT INTO "BonusCode" ("code", "tier", "durationDays", "isActive", "usedCount", "note", "updatedAt")
VALUES ('HS3DBASIC', 'basic', 3, true, 0, 'Basic на 3 дня', CURRENT_TIMESTAMP);
