-- ============================================================
-- Migration: Add Multi-Tenant (SaaS) Support
-- ============================================================

-- Step 1: Create Tenant table
CREATE TABLE "Tenant" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "planStatus" TEXT NOT NULL DEFAULT 'TRIAL',
    "trialEndsAt" TIMESTAMP(3),
    "planExpiresAt" TIMESTAMP(3),
    "maxUsers" INTEGER NOT NULL DEFAULT 3,
    "maxOrders" INTEGER NOT NULL DEFAULT 100,
    "ownerName" TEXT,
    "ownerEmail" TEXT,
    "ownerPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- Step 2: Seed default tenant (id=1 so all existing data stays valid)
INSERT INTO "Tenant" ("id", "name", "slug", "plan", "planStatus", "updatedAt")
VALUES (1, 'GestorPrint', 'gestorprint', 'PRO', 'ACTIVE', NOW());

-- Reset sequence to avoid conflict
SELECT setval(pg_get_serial_sequence('"Tenant"', 'id'), MAX("id")) FROM "Tenant";

-- ============================================================
-- Step 3: Add tenantId to all data models
-- ============================================================

-- Customer
ALTER TABLE "Customer" ADD COLUMN "tenantId" INTEGER NOT NULL DEFAULT 1;

-- ProductType
ALTER TABLE "ProductType" ADD COLUMN "tenantId" INTEGER NOT NULL DEFAULT 1;

-- Product
ALTER TABLE "Product" ADD COLUMN "tenantId" INTEGER NOT NULL DEFAULT 1;

-- Estimate
ALTER TABLE "Estimate" ADD COLUMN "tenantId" INTEGER NOT NULL DEFAULT 1;

-- Order
ALTER TABLE "Order" ADD COLUMN "tenantId" INTEGER NOT NULL DEFAULT 1;

-- Settings: convert from fixed id=1 to SERIAL + tenantId
ALTER TABLE "Settings" ADD COLUMN "tenantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Settings" ALTER COLUMN "id" DROP DEFAULT;
CREATE SEQUENCE "Settings_id_seq";
ALTER TABLE "Settings" ALTER COLUMN "id" SET DEFAULT nextval('"Settings_id_seq"');
ALTER SEQUENCE "Settings_id_seq" OWNED BY "Settings"."id";
SELECT setval('"Settings_id_seq"', COALESCE((SELECT MAX("id") FROM "Settings"), 0) + 1, false);

-- User
ALTER TABLE "User" ADD COLUMN "tenantId" INTEGER NOT NULL DEFAULT 1;

-- Expense
ALTER TABLE "Expense" ADD COLUMN "tenantId" INTEGER NOT NULL DEFAULT 1;

-- ExpenseCategory
ALTER TABLE "ExpenseCategory" ADD COLUMN "tenantId" INTEGER NOT NULL DEFAULT 1;

-- Supplier
ALTER TABLE "Supplier" ADD COLUMN "tenantId" INTEGER NOT NULL DEFAULT 1;

-- Notification
ALTER TABLE "Notification" ADD COLUMN "tenantId" INTEGER NOT NULL DEFAULT 1;

-- AiConfig: convert from fixed id=1 to SERIAL + tenantId
ALTER TABLE "AiConfig" ADD COLUMN "tenantId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AiConfig" ALTER COLUMN "id" DROP DEFAULT;
CREATE SEQUENCE "AiConfig_id_seq";
ALTER TABLE "AiConfig" ALTER COLUMN "id" SET DEFAULT nextval('"AiConfig_id_seq"');
ALTER SEQUENCE "AiConfig_id_seq" OWNED BY "AiConfig"."id";
SELECT setval('"AiConfig_id_seq"', COALESCE((SELECT MAX("id") FROM "AiConfig"), 0) + 1, false);

-- AuditLog
ALTER TABLE "AuditLog" ADD COLUMN "tenantId" INTEGER NOT NULL DEFAULT 1;

-- ============================================================
-- Step 4: Drop old global unique indexes → replace with tenant-scoped
-- ============================================================

DROP INDEX IF EXISTS "Customer_email_key";
DROP INDEX IF EXISTS "Customer_document_key";
DROP INDEX IF EXISTS "ProductType_name_key";
DROP INDEX IF EXISTS "User_email_key";
DROP INDEX IF EXISTS "ExpenseCategory_name_key";

-- New composite unique indexes (scoped per tenant)
CREATE UNIQUE INDEX "Customer_email_tenantId_key"       ON "Customer"("email", "tenantId") WHERE "email" IS NOT NULL;
CREATE UNIQUE INDEX "Customer_document_tenantId_key"    ON "Customer"("document", "tenantId") WHERE "document" IS NOT NULL;
CREATE UNIQUE INDEX "ProductType_name_tenantId_key"     ON "ProductType"("name", "tenantId");
CREATE UNIQUE INDEX "User_email_tenantId_key"           ON "User"("email", "tenantId");
CREATE UNIQUE INDEX "ExpenseCategory_name_tenantId_key" ON "ExpenseCategory"("name", "tenantId");
CREATE UNIQUE INDEX "Settings_tenantId_key"             ON "Settings"("tenantId");
CREATE UNIQUE INDEX "AiConfig_tenantId_key"             ON "AiConfig"("tenantId");

-- ============================================================
-- Step 5: Add Foreign Key constraints
-- ============================================================

ALTER TABLE "Customer"        ADD CONSTRAINT "Customer_tenantId_fkey"        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductType"     ADD CONSTRAINT "ProductType_tenantId_fkey"     FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Product"         ADD CONSTRAINT "Product_tenantId_fkey"         FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Estimate"        ADD CONSTRAINT "Estimate_tenantId_fkey"        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order"           ADD CONSTRAINT "Order_tenantId_fkey"           FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Settings"        ADD CONSTRAINT "Settings_tenantId_fkey"        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User"            ADD CONSTRAINT "User_tenantId_fkey"            FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense"         ADD CONSTRAINT "Expense_tenantId_fkey"         FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExpenseCategory" ADD CONSTRAINT "ExpenseCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Supplier"        ADD CONSTRAINT "Supplier_tenantId_fkey"        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification"    ADD CONSTRAINT "Notification_tenantId_fkey"    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiConfig"        ADD CONSTRAINT "AiConfig_tenantId_fkey"        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditLog"        ADD CONSTRAINT "AuditLog_tenantId_fkey"        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
