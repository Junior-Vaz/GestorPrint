-- Safely add salesperson/producer columns that may be missing
-- due to the failed migration 20260318180614_add_saleperson_fields

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "salespersonId" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "producerId" INTEGER;
ALTER TABLE "Estimate" ADD COLUMN IF NOT EXISTS "salespersonId" INTEGER;

-- Add foreign keys only if they don't exist yet
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Order_salespersonId_fkey' AND table_name = 'Order'
  ) THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_salespersonId_fkey"
      FOREIGN KEY ("salespersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Order_producerId_fkey' AND table_name = 'Order'
  ) THEN
    ALTER TABLE "Order" ADD CONSTRAINT "Order_producerId_fkey"
      FOREIGN KEY ("producerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Estimate_salespersonId_fkey' AND table_name = 'Estimate'
  ) THEN
    ALTER TABLE "Estimate" ADD CONSTRAINT "Estimate_salespersonId_fkey"
      FOREIGN KEY ("salespersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
