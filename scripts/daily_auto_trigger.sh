#!/usr/bin/env bash
# Automated 4:00 PM IST Daily EOD Ingestion Trigger
# Automatically downloads today's official NSE Bhavcopy, parses, validates,
# and stores daily OHLCV records in the stock_daily_history and ingested_files tables.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"
mkdir -p "$PROJECT_DIR/logs"

LOG_FILE="$PROJECT_DIR/logs/daily_auto_trigger.log"

echo "==========================================================" >> "$LOG_FILE"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Automated 4:00 PM EOD Bhavcopy Ingestion" >> "$LOG_FILE"
echo "==========================================================" >> "$LOG_FILE"

# Execute daily EOD update via python virtual environment
"$PROJECT_DIR/.venv/bin/python" -m nse_pipeline.cli.daily_update "$@" >> "$LOG_FILE" 2>&1

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Daily Ingestion Workflow Finished." >> "$LOG_FILE"
echo "" >> "$LOG_FILE"
