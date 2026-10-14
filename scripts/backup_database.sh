#!/usr/bin/env bash
# Database Backup Script for NSE Market Data Pipeline
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./data/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/nse_market_data_${TIMESTAMP}.sql.gz"

MYSQL_HOST="${MYSQL_HOST:-localhost}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-nse_app}"
MYSQL_DATABASE="${MYSQL_DATABASE:-nse_market_data}"

mkdir -p "${BACKUP_DIR}"

echo "Starting backup of ${MYSQL_DATABASE} from ${MYSQL_HOST}:${MYSQL_PORT}..."

if command -v mysqldump &> /dev/null; then
    mysqldump -h "${MYSQL_HOST}" -P "${MYSQL_PORT}" -u "${MYSQL_USER}" -p"${MYSQL_PASSWORD:-replace_with_secret}" \
        --single-transaction \
        --quick \
        --triggers \
        --routines \
        "${MYSQL_DATABASE}" | gzip > "${BACKUP_FILE}"
    echo "Backup completed successfully: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"
else
    echo "mysqldump not found on PATH. Attempting SQLite backup if present..."
    if [ -f "./data/nse_market_data.db" ]; then
        cp "./data/nse_market_data.db" "${BACKUP_DIR}/nse_market_data_${TIMESTAMP}.db"
        echo "SQLite database backed up to ${BACKUP_DIR}/nse_market_data_${TIMESTAMP}.db"
    else
        echo "No database available to backup."
        exit 1
    fi
fi
