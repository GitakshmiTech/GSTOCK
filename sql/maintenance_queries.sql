-- Maintenance queries for database health, reconciliation and cleanup

-- 1. Check for missing trading dates in stock_daily_history compared to trading_calendar
SELECT tc.trade_date
FROM trading_calendar tc
LEFT JOIN stock_daily_history sdh ON tc.trade_date = sdh.trade_date
WHERE tc.is_trading_day = TRUE
  AND tc.trade_date BETWEEN '2001-01-01' AND CURDATE()
  AND sdh.trade_date IS NULL
ORDER BY tc.trade_date ASC;

-- 2. Detect duplicate entries (sanity check)
SELECT trade_date, security_id, series, COUNT(*) AS count
FROM stock_daily_history
GROUP BY trade_date, security_id, series
HAVING COUNT(*) > 1;

-- 3. Incomplete Ingestion Jobs that stalled or failed
SELECT job_id, job_type, status, started_at, completed_at, error_message
FROM ingestion_jobs
WHERE status IN ('PENDING', 'RUNNING', 'FAILED')
ORDER BY created_at DESC;

-- 4. Orphan securities (securities without any price history records)
SELECT s.id, s.symbol, s.series, s.created_at
FROM securities s
LEFT JOIN stock_daily_history sdh ON s.id = sdh.security_id
WHERE sdh.id IS NULL;
