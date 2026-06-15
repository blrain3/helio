-- Helio 时序数据表结构（Raw SQL 管理，非 Prisma）
-- 由 worker 进程启动时执行（apps/worker/src/main.ts 中初始化）

-- =====================================================================
-- 1. 发电记录表（按月 RANGE 分区）
-- =====================================================================
CREATE TABLE IF NOT EXISTS energy_record (
    id             BIGSERIAL,
    device_id      UUID            NOT NULL,
    plant_id       UUID            NOT NULL,
    generation_kwh NUMERIC(10, 3)  NOT NULL,
    timestamp      TIMESTAMPTZ     NOT NULL,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- =====================================================================
-- 2. 设备指标表（通用指标，可扩展）
-- =====================================================================
CREATE TABLE IF NOT EXISTS device_metric (
    id           BIGSERIAL,
    device_id    UUID            NOT NULL,
    metric_key   TEXT            NOT NULL,
    metric_value NUMERIC(14, 4),
    timestamp    TIMESTAMPTZ     NOT NULL,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- =====================================================================
-- 3. 按月自动建分区（确保写入月份存在）
--    用法：SELECT ensure_energy_partition('2026-09-01');
--    幂等：已存在时直接返回，不报错。
-- =====================================================================
CREATE OR REPLACE FUNCTION ensure_energy_partition(month_start DATE)
RETURNS TEXT AS $$
DECLARE
    tbl      TEXT;
    month_end DATE;
    exists_flag BOOLEAN;
BEGIN
    month_end := (month_start + INTERVAL '1 month')::DATE;
    tbl := 'energy_record_' || to_char(month_start, 'YYYY_MM');

    SELECT EXISTS (
        SELECT 1 FROM pg_inherits i
        JOIN pg_class p ON p.oid = i.inhparent
        JOIN pg_class c ON c.oid = i.inhrelid
        WHERE p.relname = 'energy_record' AND c.relname = tbl
    ) INTO exists_flag;

    IF NOT exists_flag THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF energy_record FOR VALUES FROM (%L) TO (%L)',
            tbl, month_start, month_end
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I (timestamp)',
            'idx_' || tbl || '_ts', tbl
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I (plant_id)',
            'idx_' || tbl || '_plant', tbl
        );
    END IF;

    RETURN tbl;
END;
$$ LANGUAGE plpgsql;

-- 同物：设备指标分区
CREATE OR REPLACE FUNCTION ensure_device_metric_partition(month_start DATE)
RETURNS TEXT AS $$
DECLARE
    tbl      TEXT;
    month_end DATE;
    exists_flag BOOLEAN;
BEGIN
    month_end := (month_start + INTERVAL '1 month')::DATE;
    tbl := 'device_metric_' || to_char(month_start, 'YYYY_MM');

    SELECT EXISTS (
        SELECT 1 FROM pg_inherits i
        JOIN pg_class p ON p.oid = i.inhparent
        JOIN pg_class c ON c.oid = i.inhrelid
        WHERE p.relname = 'device_metric' AND c.relname = tbl
    ) INTO exists_flag;

    IF NOT exists_flag THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF device_metric FOR VALUES FROM (%L) TO (%L)',
            tbl, month_start, month_end
        );
        EXECUTE format(
            'CREATE INDEX IF NOT EXISTS %I ON %I (timestamp)',
            'idx_' || tbl || '_ts', tbl
        );
    END IF;

    RETURN tbl;
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- 4. 发电统计物化视图（预聚合，worker 定时 REFRESH）
--    日维度：按 plant 汇总发电量与记录数。
-- =====================================================================
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
