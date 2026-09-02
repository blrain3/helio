-- Helio 时序数据表结构（Raw SQL 管理，非 Prisma）
-- 由 worker 进程启动时执行（apps/worker/src/main.ts 中初始化）

-- 1. 发电记录表（按月 RANGE 分区）
CREATE TABLE IF NOT EXISTS energy_record (
    id          BIGSERIAL,
    device_id   UUID        NOT NULL,
    plant_id    UUID        NOT NULL,
    generation_kwh NUMERIC(10, 3) NOT NULL,
    timestamp   TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- 说明：分区在 worker 启动时按月创建，示例：
-- CREATE TABLE energy_record_2026_09 PARTITION OF energy_record
--   FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

-- 时间戳索引（在每个分区上建立）
-- CREATE INDEX idx_energy_record_ts_2026_09 ON energy_record_2026_09 (timestamp);

-- 2. 设备指标表（通用指标，可扩展）
CREATE TABLE IF NOT EXISTS device_metric (
    id          BIGSERIAL,
    device_id   UUID        NOT NULL,
    metric_key  TEXT        NOT NULL,
    metric_value NUMERIC(14, 4),
    timestamp   TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- 3. 发电统计物化视图（预聚合，worker 定时 REFRESH）
CREATE MATERIALIZED VIEW IF NOT EXISTS generation_daily_stat AS
SELECT
    plant_id,
    date_trunc('day', timestamp) AS day,
    sum(generation_kwh)          AS total_kwh,
    count(*)                     AS record_count
FROM energy_record
GROUP BY plant_id, date_trunc('day', timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_generation_daily_stat
    ON generation_daily_stat (plant_id, day);

-- 刷新：REFRESH MATERIALIZED VIEW CONCURRENTLY generation_daily_stat;
