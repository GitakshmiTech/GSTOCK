-- Supplementary performance indexes for fast dashboard queries

CREATE INDEX IF NOT EXISTS idx_stock_daily_symbol_series_date
ON stock_daily_history (symbol, series, trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_stock_daily_date_turnover
ON stock_daily_history (trade_date, turnover DESC);

CREATE INDEX IF NOT EXISTS idx_ingestion_files_status
ON ingestion_files (status, trade_date);

CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status
ON ingestion_jobs (status, created_at DESC);
