-- M3: 将 Bill.consumedKwh 从 DOUBLE PRECISION 改为 NUMERIC(10,3)
-- 对齐时序表 energy_record.generation_kwh 的精度，避免浮点误差。

ALTER TABLE "Bill" ALTER COLUMN "consumedKwh" TYPE DECIMAL(10, 3);
