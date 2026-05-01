/*
  Warnings:

  - You are about to drop the `FlowConfig` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FlowSession` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[uuid]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[referralCode]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[passwordResetToken]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[emailVerificationToken]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `Estimate` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `Expense` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `PlanConfig` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[slug]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `ProductType` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `Supplier` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[storeDomain]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[uuid]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[email,tenantId,userType]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - The required column `uuid` was added to the `Customer` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `uuid` was added to the `Estimate` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `uuid` was added to the `Expense` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `uuid` was added to the `Order` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `uuid` was added to the `PlanConfig` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `uuid` was added to the `Product` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `uuid` was added to the `ProductType` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `uuid` was added to the `Supplier` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `uuid` was added to the `Tenant` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `uuid` was added to the `Transaction` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `uuid` was added to the `User` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateEnum
CREATE TYPE "FeatureKey" AS ENUM ('PDF_GENERATION', 'FINANCIAL_REPORTS', 'KANBAN_BOARD', 'FILE_UPLOAD', 'WHATSAPP_AI', 'PIX_PAYMENTS', 'PLOTTER_ESTIMATE', 'CUTTING_ESTIMATE', 'EMBROIDERY_ESTIMATE', 'AUDIT_LOG', 'COMMISSIONS', 'API_ACCESS', 'RECEIVABLES', 'ECOMMERCE', 'MP_CARD', 'MELHOR_ENVIOS', 'LOYALTY_PROGRAM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "FlowConfig" DROP CONSTRAINT "FlowConfig_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "FlowSession" DROP CONSTRAINT "FlowSession_tenantId_fkey";

-- DropIndex
DROP INDEX "User_email_tenantId_key";

-- AlterTable
ALTER TABLE "AiConfig" ADD COLUMN     "aiProvider" TEXT NOT NULL DEFAULT 'google',
ADD COLUMN     "allowedEstimateTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "allowedProductIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "elevenlabsKey" TEXT,
ADD COLUMN     "erpAgentPrompt" TEXT,
ADD COLUMN     "erpPromptStrict" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "googleTtsKey" TEXT,
ADD COLUMN     "openaiTtsKey" TEXT,
ADD COLUMN     "quickCommands" JSONB,
ADD COLUMN     "ttsModel" TEXT DEFAULT 'tts-1',
ADD COLUMN     "ttsProvider" TEXT DEFAULT 'browser',
ADD COLUMN     "ttsVoice" TEXT DEFAULT 'nova',
ADD COLUMN     "webhookEvents" TEXT[] DEFAULT ARRAY['MESSAGES_UPSERT']::TEXT[],
ADD COLUMN     "webhookUrl" TEXT,
ADD COLUMN     "whatsappPromptStrict" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "complement" TEXT,
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "loyaltyBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltySpend12m" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyTier" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "passwordResetExpires" TIMESTAMP(3),
ADD COLUMN     "passwordResetToken" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredById" INTEGER,
ADD COLUMN     "uuid" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Estimate" ADD COLUMN     "rejectedReason" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "uuid" TEXT NOT NULL,
ADD COLUMN     "validUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "uuid" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ExpenseCategory" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cashbackEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "cashbackRedeemed" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryDate" TIMESTAMP(3),
ADD COLUMN     "loyaltyDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyProcessed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "meShipmentId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentExternalId" TEXT,
ADD COLUMN     "paymentInstallments" INTEGER,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "pointsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointsRedeemed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "shippingAddress" JSONB,
ADD COLUMN     "shippingCarrier" TEXT,
ADD COLUMN     "shippingCost" DOUBLE PRECISION,
ADD COLUMN     "shippingLabelUrl" TEXT,
ADD COLUMN     "shippingService" TEXT,
ADD COLUMN     "shippingStatus" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'ERP',
ADD COLUMN     "trackingCode" TEXT,
ADD COLUMN     "uuid" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PlanConfig" ADD COLUMN     "hasEcommerce" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasLoyalty" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasMelhorEnvios" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasMpCard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasReceivables" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "uuid" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "heightCm" INTEGER,
ADD COLUMN     "lengthCm" INTEGER,
ADD COLUMN     "longDescription" TEXT,
ADD COLUMN     "originalPrice" DECIMAL(10,2),
ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "pixDiscountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "productionDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shortDescription" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "storeOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "storePrice" DOUBLE PRECISION,
ADD COLUMN     "uuid" TEXT NOT NULL,
ADD COLUMN     "visibleInStore" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weightGrams" INTEGER,
ADD COLUMN     "widthCm" INTEGER;

-- AlterTable
ALTER TABLE "ProductType" ADD COLUMN     "applicableEstimateTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "storeIcon" TEXT,
ADD COLUMN     "storeOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "uuid" TEXT NOT NULL,
ADD COLUMN     "visibleInStore" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "businessHours" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "defaultDeliveryDays" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "loyaltyConfig" JSONB,
ADD COLUMN     "meAccessToken" TEXT,
ADD COLUMN     "meEnvironment" TEXT NOT NULL DEFAULT 'sandbox',
ADD COLUMN     "mpWebhookSecret" TEXT,
ADD COLUMN     "originAddress" JSONB,
ADD COLUMN     "originCep" TEXT,
ADD COLUMN     "paymentMethods" TEXT[] DEFAULT ARRAY['PIX', 'Cartão', 'Boleto', 'Dinheiro']::TEXT[],
ADD COLUMN     "pricingConfig" JSONB,
ADD COLUMN     "storeConfig" JSONB;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "uuid" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "storeDomain" TEXT,
ADD COLUMN     "uuid" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "uuid" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "userType" TEXT NOT NULL DEFAULT 'TENANT',
ADD COLUMN     "uuid" TEXT NOT NULL;

-- DropTable
DROP TABLE "FlowConfig";

-- DropTable
DROP TABLE "FlowSession";

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" INTEGER,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "customerId" INTEGER NOT NULL,
    "label" TEXT,
    "cep" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minPurchase" DOUBLE PRECISION,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "maxUsesPerCustomer" INTEGER NOT NULL DEFAULT 1,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "firstOrderOnly" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "customerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyTransaction" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "customerId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "cashback" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT,
    "orderId" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "expired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "productId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "comment" TEXT,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteContent" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "slides" JSONB NOT NULL DEFAULT '[]',
    "testimonials" JSONB NOT NULL DEFAULT '[]',
    "faqs" JSONB NOT NULL DEFAULT '[]',
    "about" JSONB,
    "legal" JSONB,
    "config" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "coverImage" TEXT,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "author" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT false,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "customerId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidAmount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL DEFAULT 1,
    "supplierId" INTEGER,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidAmount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiChatMessage" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "sessionId" TEXT NOT NULL DEFAULT 'erp-widget',
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "toolName" TEXT,
    "feedback" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiChatSession" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Nova conversa',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUserMemory" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUserMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiToolCall" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "userId" INTEGER,
    "sessionId" TEXT,
    "channel" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "args" JSONB,
    "result" JSONB,
    "success" BOOLEAN NOT NULL,
    "errorMsg" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "planName" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "gatewayName" TEXT,
    "gatewayCustomerId" TEXT,
    "gatewaySubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "gatewayEventId" TEXT,
    "payload" JSONB,
    "performedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantEntitlement" (
    "id" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "maxUsers" INTEGER NOT NULL,
    "maxOrders" INTEGER NOT NULL,
    "maxCustomers" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantFeatureOverride" (
    "id" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "feature" "FeatureKey" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "reason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "grantedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantFeatureOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerAddress_customerId_idx" ON "CustomerAddress"("customerId");

-- CreateIndex
CREATE INDEX "WishlistItem_customerId_idx" ON "WishlistItem"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_customerId_productId_key" ON "WishlistItem"("customerId", "productId");

-- CreateIndex
CREATE INDEX "Coupon_tenantId_active_idx" ON "Coupon"("tenantId", "active");

-- CreateIndex
CREATE INDEX "Coupon_tenantId_customerId_idx" ON "Coupon"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "Coupon_tenantId_source_idx" ON "Coupon"("tenantId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_tenantId_code_key" ON "Coupon"("tenantId", "code");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_tenantId_customerId_idx" ON "LoyaltyTransaction"("tenantId", "customerId");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_tenantId_customerId_expired_expiresAt_idx" ON "LoyaltyTransaction"("tenantId", "customerId", "expired", "expiresAt");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_tenantId_type_idx" ON "LoyaltyTransaction"("tenantId", "type");

-- CreateIndex
CREATE INDEX "LoyaltyTransaction_orderId_idx" ON "LoyaltyTransaction"("orderId");

-- CreateIndex
CREATE INDEX "Review_tenantId_idx" ON "Review"("tenantId");

-- CreateIndex
CREATE INDEX "Review_productId_status_idx" ON "Review"("productId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Review_customerId_productId_key" ON "Review"("customerId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteContent_tenantId_key" ON "SiteContent"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_tenantId_idx" ON "BlogPost"("tenantId");

-- CreateIndex
CREATE INDEX "BlogPost_tenantId_status_idx" ON "BlogPost"("tenantId", "status");

-- CreateIndex
CREATE INDEX "BlogPost_tenantId_slug_idx" ON "BlogPost"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "RolePermission_tenantId_role_idx" ON "RolePermission"("tenantId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_tenantId_role_resource_key" ON "RolePermission"("tenantId", "role", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_uuid_key" ON "Invoice"("uuid");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_status_idx" ON "Invoice"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_dueDate_idx" ON "Invoice"("tenantId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_uuid_key" ON "Bill"("uuid");

-- CreateIndex
CREATE INDEX "Bill_tenantId_idx" ON "Bill"("tenantId");

-- CreateIndex
CREATE INDEX "Bill_tenantId_status_idx" ON "Bill"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Bill_tenantId_dueDate_idx" ON "Bill"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "AiChatMessage_tenantId_userId_sessionId_createdAt_idx" ON "AiChatMessage"("tenantId", "userId", "sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatSession_tenantId_userId_lastActivity_idx" ON "AiChatSession"("tenantId", "userId", "lastActivity");

-- CreateIndex
CREATE UNIQUE INDEX "AiUserMemory_tenantId_userId_key" ON "AiUserMemory"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "AiToolCall_tenantId_createdAt_idx" ON "AiToolCall"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AiToolCall_tenantId_toolName_idx" ON "AiToolCall"("tenantId", "toolName");

-- CreateIndex
CREATE INDEX "AiToolCall_tenantId_userId_createdAt_idx" ON "AiToolCall"("tenantId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_currentPeriodEnd_idx" ON "Subscription"("currentPeriodEnd");

-- CreateIndex
CREATE INDEX "Subscription_trialEndsAt_idx" ON "Subscription"("trialEndsAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionEvent_gatewayEventId_key" ON "SubscriptionEvent"("gatewayEventId");

-- CreateIndex
CREATE INDEX "SubscriptionEvent_subscriptionId_idx" ON "SubscriptionEvent"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantEntitlement_tenantId_key" ON "TenantEntitlement"("tenantId");

-- CreateIndex
CREATE INDEX "TenantFeatureOverride_entitlementId_idx" ON "TenantFeatureOverride"("entitlementId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantFeatureOverride_entitlementId_feature_key" ON "TenantFeatureOverride"("entitlementId", "feature");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entity_idx" ON "AuditLog"("tenantId", "entity");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_uuid_key" ON "Customer"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_referralCode_key" ON "Customer"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_passwordResetToken_key" ON "Customer"("passwordResetToken");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_emailVerificationToken_key" ON "Customer"("emailVerificationToken");

-- CreateIndex
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");

-- CreateIndex
CREATE INDEX "Customer_tenantId_loyaltyTier_idx" ON "Customer"("tenantId", "loyaltyTier");

-- CreateIndex
CREATE UNIQUE INDEX "Estimate_uuid_key" ON "Estimate"("uuid");

-- CreateIndex
CREATE INDEX "Estimate_tenantId_idx" ON "Estimate"("tenantId");

-- CreateIndex
CREATE INDEX "Estimate_tenantId_status_idx" ON "Estimate"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Estimate_tenantId_estimateType_idx" ON "Estimate"("tenantId", "estimateType");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_uuid_key" ON "Expense"("uuid");

-- CreateIndex
CREATE INDEX "Expense_tenantId_idx" ON "Expense"("tenantId");

-- CreateIndex
CREATE INDEX "Expense_tenantId_date_idx" ON "Expense"("tenantId", "date");

-- CreateIndex
CREATE INDEX "ExpenseCategory_tenantId_idx" ON "ExpenseCategory"("tenantId");

-- CreateIndex
CREATE INDEX "Notification_tenantId_read_idx" ON "Notification"("tenantId", "read");

-- CreateIndex
CREATE INDEX "Notification_tenantId_createdAt_idx" ON "Notification"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_uuid_key" ON "Order"("uuid");

-- CreateIndex
CREATE INDEX "Order_tenantId_idx" ON "Order"("tenantId");

-- CreateIndex
CREATE INDEX "Order_tenantId_status_idx" ON "Order"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Order_tenantId_source_idx" ON "Order"("tenantId", "source");

-- CreateIndex
CREATE INDEX "Order_tenantId_createdAt_idx" ON "Order"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanConfig_uuid_key" ON "PlanConfig"("uuid");

-- CreateIndex
CREATE INDEX "PlanConfig_isActive_isPublic_idx" ON "PlanConfig"("isActive", "isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "Product_uuid_key" ON "Product"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");

-- CreateIndex
CREATE INDEX "Product_tenantId_typeId_idx" ON "Product"("tenantId", "typeId");

-- CreateIndex
CREATE INDEX "Product_tenantId_visibleInStore_idx" ON "Product"("tenantId", "visibleInStore");

-- CreateIndex
CREATE UNIQUE INDEX "ProductType_uuid_key" ON "ProductType"("uuid");

-- CreateIndex
CREATE INDEX "ProductType_tenantId_idx" ON "ProductType"("tenantId");

-- CreateIndex
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_uuid_key" ON "Supplier"("uuid");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_uuid_key" ON "Tenant"("uuid");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_storeDomain_key" ON "Tenant"("storeDomain");

-- CreateIndex
CREATE INDEX "Tenant_plan_isActive_idx" ON "Tenant"("plan", "isActive");

-- CreateIndex
CREATE INDEX "Tenant_planStatus_isActive_idx" ON "Tenant"("planStatus", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_uuid_key" ON "Transaction"("uuid");

-- CreateIndex
CREATE INDEX "Transaction_orderId_idx" ON "Transaction"("orderId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "User_uuid_key" ON "User"("uuid");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_tenantId_role_idx" ON "User"("tenantId", "role");

-- CreateIndex
CREATE INDEX "User_userType_idx" ON "User"("userType");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_tenantId_userType_key" ON "User"("email", "tenantId", "userType");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyTransaction" ADD CONSTRAINT "LoyaltyTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteContent" ADD CONSTRAINT "SiteContent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionEvent" ADD CONSTRAINT "SubscriptionEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantEntitlement" ADD CONSTRAINT "TenantEntitlement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFeatureOverride" ADD CONSTRAINT "TenantFeatureOverride_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "TenantEntitlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFeatureOverride" ADD CONSTRAINT "TenantFeatureOverride_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
