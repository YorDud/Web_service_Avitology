-- Add an optional operation name for financial records.
ALTER TABLE "FinancialRecord" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
