-- Migration 001: Initial Schema
-- Ingestion Tracking, Schema Versioning and Trading Calendar

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

CREATE TABLE IF NOT EXISTS ingestion_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    job_id VARCHAR(64) NOT NULL,
    trade_date DATE NULL,
    stage VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL,
    details JSON NULL,
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_job_stage (job_id, stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
