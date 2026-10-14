"""Integration tests for database bulk upsert and duplicate prevention."""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nse_pipeline.database.bulk_upsert import bulk_upsert_stock_history
from nse_pipeline.database.models import StockDailyHistory
from nse_pipeline.database.repositories.security_repository import SecurityRepository


def test_bulk_upsert_idempotency(test_db_session: Session):
    sec_repo = SecurityRepository(test_db_session)
    sec = sec_repo.get_or_create("RELIANCE", "EQ")

    trade_date = date(2024, 7, 8)
    initial_records = [{
        "trade_date": trade_date,
        "security_id": sec.id,
        "symbol": "RELIANCE",
        "series": "EQ",
        "open_price": 3000.0,
        "high_price": 3050.0,
        "low_price": 2990.0,
        "close_price": 3020.0,
        "prev_close": 2980.0,
        "vwap": 3025.0,
        "traded_quantity": 100000,
        "turnover": 302500000.0,
        "no_of_trades": 12000,
        "deliverable_quantity": 40000,
        "deliverable_pct": 40.0,
        "source_format": "udiff_bhavcopy",
        "source_file": "sample.csv",
    }]

    # 1. First insert
    count1 = bulk_upsert_stock_history(test_db_session, initial_records)
    test_db_session.commit()
    assert count1 == 1

    total_rows = test_db_session.execute(select(func.count(StockDailyHistory.id))).scalar()
    assert total_rows == 1

    # 2. Re-import with corrected price (Idempotent test)
    updated_records = [{
        "trade_date": trade_date,
        "security_id": sec.id,
        "symbol": "RELIANCE",
        "series": "EQ",
        "open_price": 3000.0,
        "high_price": 3050.0,
        "low_price": 2990.0,
        "close_price": 3025.50,  # Corrected close price
        "prev_close": 2980.0,
        "vwap": 3025.0,
        "traded_quantity": 100000,
        "turnover": 302500000.0,
        "no_of_trades": 12000,
        "deliverable_quantity": 40000,
        "deliverable_pct": 40.0,
        "source_format": "udiff_bhavcopy",
        "source_file": "sample_revised.csv",
    }]

    count2 = bulk_upsert_stock_history(test_db_session, updated_records)
    test_db_session.commit()
    assert count2 == 1

    # Verify no duplicates were inserted
    total_rows_after = test_db_session.execute(select(func.count(StockDailyHistory.id))).scalar()
    assert total_rows_after == 1

    # Verify value was updated
    record = test_db_session.execute(select(StockDailyHistory)).scalar_one()
    assert float(record.close_price) == 3025.50
    assert record.source_file == "sample_revised.csv"
