-- Migration 003: Corporate Actions & Data Quality Tracking

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
