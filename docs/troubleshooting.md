# Troubleshooting Guide

## Common Issues & Resolutions

### 1. File Not Found (HTTP 404) at 16:00 IST
- **Cause**: The exchange often publishes final Bhavcopies between 16:30 and 18:30 IST.
- **Resolution**: The updater is configured to retry automatically with exponential backoff up to `DAILY_RETRY_MAX_WAIT_MINUTES` (default: 60 minutes). If delayed further, rerun later using `python -m nse_pipeline.cli.daily_update`.

### 2. Job Lock Acquisition Error
- **Error**: `Another instance of job 'daily_update' is currently running.`
- **Cause**: An active backfill or prior scheduled run holds `./data/daily_update.lock`.
- **Resolution**: Verify if a process is still running with `ps aux | grep nse_pipeline`. If the process terminated unexpectedly, delete the stale lock file:
  ```bash
  rm ./data/daily_update.lock
  ```

### 3. File Quarantined in `data/quarantine/`
- **Cause**: The downloaded archive failed CRC/unzip integrity checks or had fatal validation errors.
- **Resolution**: Inspect the associated `.reason.txt` note inside `data/quarantine/`. Check if NSE issued a revised file, and rerun with `--force`.

### 4. MySQL Access Denied or Service Down
- **Behavior**: The pipeline automatically switches to SQLite fallback if `USE_SQLITE_FALLBACK=true` in `.env`.
- **Resolution**: To connect directly to MySQL, verify container status (`docker compose ps`) or inspect credentials in `.env`.

### 5. Extreme Price Swing Warnings
- **Behavior**: Warning records logged to `data_quality_issues` when `abs(close - prev_close) / prev_close > 20%`.
- **Note**: Does not block ingestion, but records for investigation (e.g. stock split or circuit filter event).
