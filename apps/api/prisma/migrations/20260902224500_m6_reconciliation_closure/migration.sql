-- M6: 日对账闭环 —— 差异记录关联支付流水（冻结退款 / RESOLVED 解锁）
-- ReconciliationDiff 增加 paymentId：标识差异关联的本地支付流水，
-- 供退款前「冻结检查」使用；MISSING_IN_LOCAL 类型无本地流水，paymentId 为 NULL。

ALTER TABLE "ReconciliationDiff" ADD COLUMN "paymentId" TEXT;

CREATE INDEX "ReconciliationDiff_paymentId_status_idx" ON "ReconciliationDiff"("paymentId", "status");
