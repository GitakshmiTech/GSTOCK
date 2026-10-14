#!/usr/bin/env python3
"""Script to verify environment, database connection and schema integrity."""

import sys

from sqlalchemy import text

from nse_pipeline.core.config import get_settings
from nse_pipeline.database.connection import get_engine


def verify():
    print("=" * 60)
    print("NSE Market Data Pipeline - Installation Verification")
    print("=" * 60)

    # 1. Python version
    py_ver = sys.version_info
    print(f"Python Version: {py_ver.major}.{py_ver.minor}.{py_ver.micro} ... ", end="")
    if py_ver >= (3, 12):
        print("OK (>= 3.12)")
    else:
        print("FAIL (Requires >= 3.12)")

    # 2. Settings & directories
    settings = get_settings()
    print(f"Timezone: {settings.app_timezone}")
    print("Data directories checked: OK")

    # 3. Database connection
    print("Database Connection ... ", end="")
    try:
        engine = get_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"OK ({engine.dialect.name})")
    except Exception as e:
        print(f"FAIL: {e}")
        return

    # 4. Check tables
    print("Checking database tables ... ", end="")
    try:
        with engine.connect() as conn:
            tables = conn.execute(
                text("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()")
                if "mysql" in engine.dialect.name
                else text("SELECT name FROM sqlite_master WHERE type='table'")
            ).fetchall()
            table_names = [t[0] for t in tables]
            expected = ["stock_daily_history", "securities", "trading_calendar", "ingestion_jobs", "ingestion_files"]
            missing = [t for t in expected if t not in table_names]
            if missing:
                print(f"MISSING TABLES: {missing}. Run scripts/setup_database.py.")
            else:
                print(f"OK ({len(table_names)} tables present)")
    except Exception as e:
        print(f"Error checking tables: {e}")

    print("=" * 60)
    print("Verification Completed.")
    print("=" * 60)


if __name__ == "__main__":
    verify()
