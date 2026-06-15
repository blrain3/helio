-- M5: 异常检测结果表
CREATE TABLE "AnomalyEvent" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "deviceId" TEXT,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" INTEGER NOT NULL,
    "severity" TEXT NOT NULL,
    "anomalyScore" DOUBLE PRECISION NOT NULL,
    "baselineValue" DOUBLE PRECISION,
    "actualValue" DOUBLE PRECISION NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnomalyEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnomalyEvent_plantId_detectedAt_idx" ON "AnomalyEvent"("plantId", "detectedAt");
CREATE INDEX "AnomalyEvent_ruleId_detectedAt_idx" ON "AnomalyEvent"("ruleId", "detectedAt");
