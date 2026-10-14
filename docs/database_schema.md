# Database Design & Schema Specifications

## Overview
The schema is partitioned across core domain models, security identifiers, audit history, and market calendar entities.

## Entity Relationship Summary
```
+------------------+         1:N         +---------------------+
|    securities    | ───────────────────< | stock_daily_history |
+------------------+                     +---------------------+
        │ 1:N                                       │
        │                                           │ N:1
        ▼                                           ▼
+-------------------------+              +---------------------+
| security_symbol_history |              |  trading_calendar   |
+-------------------------+              +---------------------+
        │
        │ 1:N
        ▼
+-------------------------+
|    corporate_actions    |
+-------------------------+

+------------------+         1:N         +---------------------+
|  ingestion_jobs  | ───────────────────< |   ingestion_files   |
+------------------+                     +---------------------+
        │ 1:N                                       │
        ▼                                           ▼
+------------------+                     +---------------------+
|  ingestion_log   |                     | data_quality_issues |
+------------------+                     +---------------------+
```

## Core Tables

### 1. `stock_daily_history`
Stores daily OHLCV, turnover, delivery statistics, and source provenance.
- Primary Key: `id BIGINT UNSIGNED AUTO_INCREMENT`
- Foreign Key: `security_id -> securities(id)`
- Unique Key: `uq_daily_security (trade_date, security_id, series)`
- Indexes:
  - `idx_symbol_date (symbol, trade_date)`
  - `idx_date (trade_date)`
  - `idx_security_date (security_id, trade_date)`

### 2. `securities`
Tracks registered companies, current ticker symbols, and ISIN.
- Primary Key: `id BIGINT UNSIGNED AUTO_INCREMENT`
- Unique Key: `uq_symbol_series (symbol, series)`
- Index: `idx_isin (isin)`

### 3. `security_symbol_history`
Maintains audit trail of historical corporate ticker renames.
- Foreign Key: `security_id -> securities(id)`

### 4. `corporate_actions`
Stores splits, bonuses, dividends, and rights issues.
- Unique Key: `uq_corp_action (symbol, series, event_type, ex_date)`

### 5. `ingestion_jobs` & `ingestion_files`
Tracks every backfill, daily execution, file checksum (SHA-256), duration, row counts, and status.

### 6. `data_quality_issues`
Contains rule violations, extreme price swings, and data warnings.

### 7. `trading_calendar`
Records session dates from 2001 to 2026, marking weekends and exchange holidays.
