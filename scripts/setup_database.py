#!/usr/bin/env python3
"""Script to initialize database tables and seed trading calendar."""

from nse_pipeline.database.session import get_db_session, init_db
from nse_pipeline.scheduler.trading_calendar import NSETradingCalendar

if __name__ == "__main__":
    print("Setting up database...")
    init_db()
    with get_db_session() as session:
        print("Seeding trading calendar 2001-2026...")
        count = NSETradingCalendar.seed_calendar(session, start_year=2001, end_year=2026)
        print(f"Seeded {count} dates into trading calendar.")
    print("Database setup complete.")
