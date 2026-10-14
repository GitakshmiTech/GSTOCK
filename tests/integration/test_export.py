"""Integration tests for export service."""

from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

from nse_pipeline.database.bulk_upsert import bulk_upsert_stock_history
from nse_pipeline.database.repositories.security_repository import SecurityRepository
from nse_pipeline.services.export_service import ExportService


def test_export_csv_and_excel(test_db_session: Session, tmp_path: Path):
    sec_repo = SecurityRepository(test_db_session)
    sec = sec_repo.get_or_create("TCS", "EQ")

    bulk_upsert_stock_history(
        test_db_session,
        [{
            "trade_date": date(2024, 7, 8),
            "security_id": sec.id,
            "symbol": "TCS",
            "series": "EQ",
            "open_price": 3920.0,
            "high_price": 3960.0,
            "low_price": 3915.0,
            "close_price": 3952.10,
            "prev_close": 3910.0,
            "vwap": 3945.0,
            "traded_quantity": 1850000,
            "turnover": 7300000000.0,
            "source_format": "udiff_bhavcopy",
            "source_file": "sample.csv",
        }],
    )
    test_db_session.commit()

    service = ExportService(test_db_session)

    # 1. Export CSV
    csv_file = service.export_symbol_history("TCS", format_type="csv")
    assert csv_file.exists()
    assert csv_file.suffix == ".csv"
    assert csv_file.stat().st_size > 0

    # 2. Export Excel
    excel_file = service.export_symbol_history("TCS", format_type="excel")
    assert excel_file.exists()
    assert excel_file.suffix == ".xlsx"
    assert excel_file.stat().st_size > 0
