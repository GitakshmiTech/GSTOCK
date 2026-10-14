"""Integration tests for Ingestion and Backfill workflows."""

from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nse_pipeline.core.constants import FileStatus
from nse_pipeline.database.models import IngestionFile, Security, StockDailyHistory
from nse_pipeline.services.ingestion_service import IngestionService


def test_ingest_legacy_file(test_db_session: Session, legacy_sample_path: Path):
    service = IngestionService(test_db_session)
    result = service.ingest_file(legacy_sample_path)

    assert result.status == FileStatus.IMPORTED
    assert result.raw_row_count == 4
    assert result.inserted_count == 4
    assert result.rejected_count == 0

    # Verify rows in database
    count = test_db_session.execute(select(func.count(StockDailyHistory.id))).scalar()
    assert count == 4

    # Verify Securities created in master
    sec_count = test_db_session.execute(select(func.count(Security.id))).scalar()
    assert sec_count == 4


def test_ingest_udiff_zip_file(test_db_session: Session, udiff_zip_path: Path):
    service = IngestionService(test_db_session)
    result = service.ingest_file(udiff_zip_path)

    assert result.status == FileStatus.IMPORTED
    assert result.raw_row_count == 3
    assert result.inserted_count == 3

    # Audit log recorded
    ingested_files = test_db_session.execute(select(IngestionFile)).scalars().all()
    assert len(ingested_files) >= 1
    assert ingested_files[0].status == "IMPORTED"
