-- M4: 支付与退款模型扩展
-- 1. Payment 增加 refundedAmount（已退款累计，分）
-- 2. Refund 增加 refundNo（业务退款单号，唯一）与 providerRefundId（渠道退款流水号）

ALTER TABLE "Payment" ADD COLUMN "refundedAmount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Refund" ADD COLUMN "refundNo" TEXT;
ALTER TABLE "Refund" ADD COLUMN "providerRefundId" TEXT;
ALTER TABLE "Refund" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 为已有退款单生成唯一退款单号（避免唯一约束冲突）
UPDATE "Refund" SET "refundNo" = 'RFN' || replace(gen_random_uuid()::text, '-', '') WHERE "refundNo" IS NULL;

ALTER TABLE "Refund" ALTER COLUMN "refundNo" SET NOT NULL;
CREATE UNIQUE INDEX "Refund_refundNo_key" ON "Refund"("refundNo");
