PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "FinancialRecord" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "userId" INTEGER NOT NULL,
  "recordDate" TEXT NOT NULL,
  "income" INTEGER NOT NULL DEFAULT 0,
  "expense" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,

  CONSTRAINT "FinancialRecord_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "User" ("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "FinancialRecord_userId_recordDate_key"
ON "FinancialRecord" ("userId", "recordDate");

CREATE INDEX IF NOT EXISTS "FinancialRecord_userId_recordDate_idx"
ON "FinancialRecord" ("userId", "recordDate");