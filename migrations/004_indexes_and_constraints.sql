-- Migration 004: Stock Daily History & Primary Indexes

CREATE TABLE IF NOT EXISTS stock_daily_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    trade_date DATE NOT NULL,
    security_id BIGINT UNSIGNED NOT NULL,
    symbol VARCHAR(100) NOT NULL,
    series VARCHAR(20) NOT NULL,

    prev_close DECIMAL(18, 6) NULL,
    open_price DECIMAL(18, 6) NULL,
    high_price DECIMAL(18, 6) NULL,
    low_price DECIMAL(18, 6) NULL,
    last_price DECIMAL(18, 6) NULL,
    close_price DECIMAL(18, 6) NULL,
    vwap DECIMAL(18, 6) NULL,

    traded_quantity BIGINT UNSIGNED NULL,
    turnover DECIMAL(24, 4) NULL,
    no_of_trades BIGINT UNSIGNED NULL,
    deliverable_quantity BIGINT UNSIGNED NULL,
    deliverable_pct DECIMAL(9, 4) NULL,

    source_format VARCHAR(40) NOT NULL,
    source_file VARCHAR(512) NULL,
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_daily_security (
        trade_date, security_id, series
    ),

    INDEX idx_symbol_date (symbol, trade_date),
    INDEX idx_date (trade_date),
    INDEX idx_security_date (security_id, trade_date),
    CONSTRAINT fk_daily_history_security
        FOREIGN KEY (security_id) REFERENCES securities (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
