# System Architecture

## Overview
The **NSE Market Data Pipeline** is an enterprise-grade Python 3.12+ and MySQL 8.0+ market data platform designed to download, normalize, validate, store, and serve historical and daily End-of-Day (EOD) market data from the National Stock Exchange of India (NSE) from **1 January 2001 through 8 October 2026**.

## High-Level Architecture Diagram

```
+---------------------------------------------------------------------------------+
|                                 DATA SOURCES                                    |
|   1. NSE Public Historical Archives (2001 - 2024 Legacy Bhavcopy)               |
|   2. NSE Public UDiFF Common Bhavcopy (From 8 July 2024 onwards)                |
|   3. Local Files (CSV / ZIP / GZIP manual import)                               |
|   4. Pluggable Authorized Paid Feed (Direct SFTP/API Connector)                 |
+---------------------------------------------------------------------------------+
                                       │
                                       ▼
+---------------------------------------------------------------------------------+
|                               DOWNLOAD MANAGER                                  |
|   - ArchiveResolver: URL formulation for Legacy & UDiFF formats                 |
|   - PublicArchiveClient: Session cookies warmup, browser headers, httpx stream  |
|   - FileRegistry: Local caching in data/raw/YYYY/MM/, quarantine isolation      |
|   - Checksum: SHA-256 calculation for deduplication and audit                   |
|   - RetryPolicy: Exponential backoff with Tenacity for network resilience       |
+---------------------------------------------------------------------------------+
                                       │
                                       ▼
+---------------------------------------------------------------------------------+
|                        FORMAT DETECTION & PARSING LAYER                         |
|   - ParserFactory: Header inspection & regex filename dispatch                  |
|   - LegacyBhavcopyParser: pre-July 2024 CSV & ZIP extractor                     |
|   - UdiffBhavcopyParser: post-July 2024 UDiFF format parser                     |
|   - ZipParser & GzipParser: In-memory stream extraction                         |
+---------------------------------------------------------------------------------+
                                       │
                                       ▼
+---------------------------------------------------------------------------------+
|                           NORMALIZATION & VALIDATION                            |
|   - ColumnMapper: Maps heterogeneous headers into canonical schema              |
|   - Normalizer: Date Normalizer, Numeric Normalizer (replaces blank with None)  |
|   - SchemaValidator: Mandatory types, presence of keys                          |
|   - PriceValidator: High >= Low/Open/Close, Prices > 0, extreme swing flags     |
|   - DuplicateValidator: Intra-batch duplicate deduplication                     |
|   - QualityReportEngine: Segregates valid records & logs quality issues         |
+---------------------------------------------------------------------------------+
                                       │
                                       ▼
+---------------------------------------------------------------------------------+
|                                DATABASE ACCESS                                  |
|   - SecurityRepository: Auto-creation & resolution of Security IDs             |
|   - PriceRepository: Optimized Bulk Upsert (ON DUPLICATE KEY UPDATE)            |
|   - IngestionRepository: Job tracking, file audit trail, stage logs             |
|   - MySQL 8.0+ Engine (with SQLite fallback for isolated unit tests)            |
+---------------------------------------------------------------------------------+
                                       │
                  ┌────────────────────┴────────────────────┐
                  ▼                                         ▼
+-----------------------------------+     +-----------------------------------+
|         APPLICATION APIS          |     |          SCHEDULER & CLI          |
|  FastAPI (Port 8000)              |     |  APScheduler (4:00 PM IST)        |
|  - GET /api/v1/prices/{symbol}    |     |  Typer CLI Commands:              |
|  - GET /api/v1/securities         |     |  - setup-database                 |
|  - GET /api/v1/ingestion/jobs     |     |  - backfill                       |
|  - GET /api/v1/quality/issues     |     |  - daily-update                   |
|  - Health checks                  |     |  - export-data (CSV / Excel)      |
+-----------------------------------+     +-----------------------------------+
```

## Component Boundaries
1. **Clients**: Handles network transport and protocol specifics.
2. **Parsers**: Operates purely on raw files into DataFrames without database dependencies.
3. **Normalization**: Pure functional data transformations.
4. **Validation**: Rule-based quality gating.
5. **Repositories**: Encapsulates SQL transactions and schema interactions.
6. **Services**: Composable workflows orchestrated by business rules.
