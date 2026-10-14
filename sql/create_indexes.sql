-- Supplementary and analytical indexes for reporting & performance

-- Fast lookups for daily symbol price trends
CREATE INDEX IF NOT EXISTS idx_stock_daily_symbol_series_date
ON stock_daily_history (symbol, series, trade_date DESC);

-- Fast scans for specific trade dates across entire market
CREATE INDEX IF NOT EXISTS idx_stock_daily_date_turnover
ON stock_daily_history (trade_date, turnover DESC);

-- Fast lookup for audit files
CREATE INDEX IF NOT EXISTS idx_ingestion_files_status
ON ingestion_files (status, trade_date);

-- Fast lookup for jobs
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status
ON ingestion_jobs (status, created_at DESC);
