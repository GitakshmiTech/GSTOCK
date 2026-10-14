-- Useful reporting and analysis queries for the NSE market data pipeline

-- 1. Market turnover and trading volume by date
SELECT
    trade_date,
    COUNT(DISTINCT symbol) AS active_securities_count,
    SUM(traded_quantity) AS total_market_volume,
    SUM(turnover) AS total_market_turnover,
    SUM(no_of_trades) AS total_trades
FROM stock_daily_history
WHERE series IN ('EQ', 'BE', 'BZ')
GROUP BY trade_date
ORDER BY trade_date DESC
LIMIT 30;

-- 2. Top 10 traded securities on a specific trade date
SELECT
    symbol,
    series,
    close_price,
    traded_quantity,
    turnover,
    no_of_trades,
    ROUND(((close_price - prev_close) / prev_close) * 100, 2) AS price_change_pct
FROM stock_daily_history
WHERE trade_date = '2024-07-08' AND series = 'EQ'
ORDER BY turnover DESC
LIMIT 10;

-- 3. Pipeline Ingestion Summary
SELECT
    status,
    COUNT(*) AS total_files,
    SUM(inserted_count) AS total_rows_inserted,
    SUM(updated_count) AS total_rows_updated,
    MIN(trade_date) AS earliest_date,
    MAX(trade_date) AS latest_date
FROM ingestion_files
GROUP BY status;

-- 4. Recent Data Quality Issues
SELECT
    trade_date,
    rule_name,
    severity,
    COUNT(*) AS issue_count
FROM data_quality_issues
GROUP BY trade_date, rule_name, severity
ORDER BY trade_date DESC, issue_count DESC
LIMIT 20;
