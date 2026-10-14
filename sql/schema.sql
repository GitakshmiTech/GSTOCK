-- Consolidated schema DDL for MySQL 8.0+

CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trading_calendar (
    trade_date DATE PRIMARY KEY,
    session_type VARCHAR(30) NOT NULL DEFAULT 'EQUITY',
    is_trading_day BOOLEAN NOT NULL DEFAULT TRUE,
    is_holiday BOOLEAN NOT NULL DEFAULT FALSE,
    holiday_name VARCHAR(150) NULL,
    is_weekend BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS securities (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    symbol VARCHAR(100) NOT NULL,
    series VARCHAR(20) NOT NULL DEFAULT 'EQ',
    company_name VARCHAR(255) NULL,
    isin VARCHAR(20) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    first_traded_date DATE NULL,
    last_traded_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_symbol_series (symbol, series),
    INDEX idx_isin (isin),
    INDEX idx_symbol (symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS security_symbol_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    security_id BIGINT UNSIGNED NOT NULL,
    symbol VARCHAR(100) NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE NULL,
    change_reason VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_security_history (security_id, valid_from),
    CONSTRAINT fk_symbol_history_security
        FOREIGN KEY (security_id) REFERENCES securities (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
    UNIQUE KEY uq_daily_security (trade_date, security_id, series),
    INDEX idx_symbol_date (symbol, trade_date),
    INDEX idx_date (trade_date),
    INDEX idx_security_date (security_id, trade_date),
    CONSTRAINT fk_daily_history_security
        FOREIGN KEY (security_id) REFERENCES securities (id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS corporate_actions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    security_id BIGINT UNSIGNED NULL,
    symbol VARCHAR(100) NOT NULL,
    series VARCHAR(20) NOT NULL DEFAULT 'EQ',
    event_type VARCHAR(50) NOT NULL,
    ex_date DATE NOT NULL,
    record_date DATE NULL,
    ratio_numerator DECIMAL(18, 6) NULL,
    ratio_denominator DECIMAL(18, 6) NULL,
    amount DECIMAL(18, 6) NULL,
    notes TEXT NULL,
    source_file VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_corp_action (symbol, series, event_type, ex_date),
    INDEX idx_corp_action_date (ex_date),
    CONSTRAINT fk_corp_action_security
        FOREIGN KEY (security_id) REFERENCES securities (id)
        ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ingestion_jobs (
    job_id VARCHAR(64) PRIMARY KEY,
    job_type VARCHAR(50) NOT NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    total_dates INT UNSIGNED DEFAULT 0,
    successful_dates INT UNSIGNED DEFAULT 0,
    failed_dates INT UNSIGNED DEFAULT 0,
    total_rows_imported BIGINT UNSIGNED DEFAULT 0,
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ingestion_files (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_id VARCHAR(64) NOT NULL,
    trade_date DATE NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NULL,
    source_url VARCHAR(512) NULL,
    file_size BIGINT UNSIGNED NULL,
    checksum_sha256 VARCHAR(64) NULL,
    source_format VARCHAR(40) NOT NULL,
    parser_version VARCHAR(20) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    row_count INT UNSIGNED DEFAULT 0,
    parsed_count INT UNSIGNED DEFAULT 0,
    inserted_count INT UNSIGNED DEFAULT 0,
    updated_count INT UNSIGNED DEFAULT 0,
    skipped_count INT UNSIGNED DEFAULT 0,
    rejected_count INT UNSIGNED DEFAULT 0,
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_job_date (job_id, trade_date),
    INDEX idx_trade_date (trade_date),
    UNIQUE KEY uq_date_checksum (trade_date, checksum_sha256)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS data_quality_issues (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    trade_date DATE NOT NULL,
    symbol VARCHAR(100) NULL,
    series VARCHAR(20) NULL,
    rule_name VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'WARNING',
    issue_details TEXT NOT NULL,
    raw_data JSON NULL,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_quality_date (trade_date),
    INDEX idx_quality_symbol (symbol),
    INDEX idx_quality_severity (severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
