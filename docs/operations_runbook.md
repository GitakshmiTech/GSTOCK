# Operations Runbook

## Daily Operations Checklist

### 1. Daily 4:00 PM IST Automated Ingestion
- The scheduled job triggers at **16:00 Asia/Kolkata**.
- Checks `trading_calendar` to skip exchange holidays and weekends.
- Polls the NSE servers with exponential backoff up to 60 minutes for publication.
- Normalizes and validates incoming records.
- Performs bulk upsert into `stock_daily_history`.
- In case of non-publication or failure, an alert is dispatched via configured channels.

### 2. Manual Daily Run
If the automated job requires a manual trigger:
```bash
python -m nse_pipeline.cli.daily_update --date 2026-10-08
```

### 3. Historical Backfill Execution
To perform date range backfills:
```bash
# Specific 5-day test
python -m nse_pipeline.cli.backfill --start 2024-07-08 --end 2024-07-12

# Complete backfill
python -m nse_pipeline.cli.backfill --start 2001-01-01 --end 2026-10-08 --resume
```

### 4. Database Setup & Migrations
```bash
python -m nse_pipeline.cli.setup_database
```

### 5. Running REST API
```bash
uvicorn nse_pipeline.api.app:app --host 0.0.0.0 --port 8000
```
Browse interactive documentation at `http://localhost:8000/docs`.

### 6. Exporting Market Data
```bash
python -m nse_pipeline.cli.export_data --symbol RELIANCE --start 2020-01-01 --end 2026-10-08 --format csv
```
Files will be placed in `./data/exports/`.
