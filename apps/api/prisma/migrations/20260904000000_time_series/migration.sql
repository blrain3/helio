-- 时序数据：Raw SQL 管理，Prisma 迁移负责在所有环境中统一执行。

CREATE TABLE IF NOT EXISTS energy_record (
    id             BIGSERIAL,
    device_id      UUID            NOT NULL,
    plant_id       UUID            NOT NULL,
    generation_kwh NUMERIC(10, 3)  NOT NULL,
    timestamp      TIMESTAMPTZ     NOT NULL,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

CREATE TABLE IF NOT EXISTS device_metric (
    id           BIGSERIAL,
    device_id    UUID            NOT NULL,
    metric_key   TEXT            NOT NULL,
    metric_value NUMERIC(14, 4),
    timestamp    TIMESTAMPTZ     NOT NULL,
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

CREATE OR REPLACE FUNCTION ensure_energy_partition(month_start DATE)
RETURNS TEXT AS $$
DECLARE
    tbl TEXT;
    month_end DATE;
    exists_flag BOOLEAN;
BEGIN
    month_end := (month_start + INTERVAL '1 month')::DATE;
    tbl := 'energy_record_' || to_char(month_start, 'YYYY_MM');

    SELECT EXISTS (
        SELECT 1
        FROM pg_inherits i
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

CREATE OR REPLACE FUNCTION ensure_device_metric_partition(month_start DATE)
RETURNS TEXT AS $$
DECLARE
    tbl TEXT;
    month_end DATE;
    exists_flag BOOLEAN;
BEGIN
    month_end := (month_start + INTERVAL '1 month')::DATE;
    tbl := 'device_metric_' || to_char(month_start, 'YYYY_MM');

    SELECT EXISTS (
        SELECT 1
        FROM pg_inherits i
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

CREATE MATERIALIZED VIEW IF NOT EXISTS generation_daily_stat AS
SELECT
    plant_id,
    date_trunc('day', timestamp) AS day,
    sum(generation_kwh) AS total_kwh,
    count(*) AS record_count
FROM energy_record
GROUP BY plant_id, date_trunc('day', timestamp);

CREATE UNIQUE INDEX IF NOT EXISTS idx_generation_daily_stat
    ON generation_daily_stat (plant_id, day);
