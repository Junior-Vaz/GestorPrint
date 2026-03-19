-- Safely add address fields to Customer table that are missing
-- from the original database (pre-consolidation schema).

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "zipCode"      TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "address"      TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "number"       TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "neighborhood" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "city"         TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "state"        TEXT;
