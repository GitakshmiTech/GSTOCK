-- Migration 002: Security Master & Symbol History

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
