"""Integration tests for automated NSE Bhavcopy download, validation, and database import."""

import io
import zipfile
from datetime import date
from pathlib import Path
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nse_pipeline.api.app import app
from nse_pipeline.api.dependencies import get_db
from nse_pipeline.core.constants import FileStatus, SourceFormat
from nse_pipeline.database.models import IngestionFile, IngestionJob, StockDailyHistory
from nse_pipeline.downloader.download_manager import DownloadBytesResult
from nse_pipeline.services.bhavcopy_service import BhavcopyService
from nse_pipeline.services.ingestion_service import IngestionService


def _create_sample_udiff_zip_bytes(sample_path: Path) -> bytes:
    content = sample_path.read_text(encoding="utf-8")
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("BhavCopy_NSE_CM_0_0_0_20240708_F_0000.csv", content)
    return bio.getvalue()


def test_bhavcopy_inmemory_ingestion_and_idempotency(test_db_session: Session, udiff_sample_path: Path):
    """Verifies in-memory parsing, initial insert, and idempotent upsert count accounting."""
    zip_bytes = _create_sample_udiff_zip_bytes(udiff_sample_path)
    service = IngestionService(test_db_session)

    # 1. First Ingestion: All 3 records should be inserted
    res1 = service.ingest_bytes(
        data=zip_bytes,
        file_name="BhavCopy_NSE_CM_0_0_0_20240708_F_0000.csv.zip",
        trade_date_override=date(2024, 7, 8),
        job_id="job_test_001",
    )

    assert res1.status == FileStatus.IMPORTED
    assert res1.raw_row_count == 3
    assert res1.parsed_count == 3
    assert res1.inserted_count == 3
    assert res1.updated_count == 0
    assert res1.rejected_count == 0

    count = test_db_session.execute(select(func.count(StockDailyHistory.id))).scalar()
    assert count == 3

    # 2. Second Ingestion (duplicate import of same date): Should update, 0 new inserts
    res2 = service.ingest_bytes(
        data=zip_bytes,
        file_name="BhavCopy_NSE_CM_0_0_0_20240708_F_0000.csv.zip",
        trade_date_override=date(2024, 7, 8),
        job_id="job_test_002",
    )

    assert res2.status == FileStatus.IMPORTED
    assert res2.raw_row_count == 3
    assert res2.inserted_count == 0
    assert res2.updated_count == 3
    assert res2.rejected_count == 0

    # Total rows must remain exactly 3 (idempotent, no duplicates)
    count_after = test_db_session.execute(select(func.count(StockDailyHistory.id))).scalar()
    assert count_after == 3


def test_bhavcopy_service_download_and_import(test_db_session: Session, udiff_sample_path: Path):
    """Tests BhavcopyService workflow with mock NSE download."""
    zip_bytes = _create_sample_udiff_zip_bytes(udiff_sample_path)
    target_d = date(2024, 7, 9)
    filename = "BhavCopy_NSE_CM_0_0_0_20240709_F_0000.csv.zip"
    mock_dl = DownloadBytesResult(
        trade_date=target_d,
        file_name=filename,
        data=zip_bytes,
        file_size=len(zip_bytes),
        checksum_sha256="mock_hash_12345",
        source_url="https://archives.nseindia.com/mock.zip",
        source_format=SourceFormat.UDIFF_BHAVCOPY,
    )

    bhav_svc = BhavcopyService(session=test_db_session)

    # Patch download_bytes_for_date
    with patch.object(bhav_svc.download_manager, "download_bytes_for_date", return_value=mock_dl):
        result = bhav_svc.download_and_import(target_date=target_d)

        assert result["status"] == "success"
        assert result["records_downloaded"] == 3
        assert result["records_inserted"] == 3
        assert result["records_updated"] == 0
        assert result["records_rejected"] == 0
        assert filename in result["file_name"]

    # Verify audit job was recorded
    job = test_db_session.execute(
        select(IngestionJob).where(IngestionJob.start_date == target_d)
    ).scalars().first()
    assert job is not None
    assert job.status == "SUCCESS"


def test_bhavcopy_service_weekend_or_holiday(test_db_session: Session):
    """Verifies that non-trading days return skipped status unless force=True."""
    bhav_svc = BhavcopyService(session=test_db_session)
    # Sunday
    sunday = date(2024, 7, 7)
    res = bhav_svc.download_and_import(target_date=sunday, force=False)
    assert res["status"] == "skipped"
    assert "not an official NSE trading day" in res["message"]


def test_bhavcopy_service_download_failure(test_db_session: Session):
    """Verifies handling when NSE reports are unavailable or 404."""
    bhav_svc = BhavcopyService(session=test_db_session)
    with patch.object(bhav_svc.download_manager, "download_bytes_for_date", return_value=None):
        res = bhav_svc.download_and_import(target_date=date(2024, 7, 9))
        assert res["status"] == "failed"
        assert "not available on NSE servers" in res["message"]


def test_api_download_and_import_endpoints(test_db_session: Session, udiff_sample_path: Path):
    """Tests the FastAPI routes for Bhavcopy download and import."""
    app.dependency_overrides[get_db] = lambda: test_db_session
    client = TestClient(app)

    # 1. Latest Available Date
    resp_date = client.get("/api/v1/ingestion/latest-available-date")
    assert resp_date.status_code == 200
    date_data = resp_date.json()
    assert "latest_trade_date" in date_data
    assert "expected_filename" in date_data

    # 2. Trigger Download and Import with mock
    zip_bytes = _create_sample_udiff_zip_bytes(udiff_sample_path)
    target_d = date(2024, 7, 10)
    filename = "BhavCopy_NSE_CM_0_0_0_20240710_F_0000.csv.zip"
    mock_dl = DownloadBytesResult(
        trade_date=target_d,
        file_name=filename,
        data=zip_bytes,
        file_size=len(zip_bytes),
        checksum_sha256="mock_sha_abc",
        source_url="https://archives.nseindia.com/mock.zip",
        source_format=SourceFormat.UDIFF_BHAVCOPY,
    )

    with patch("nse_pipeline.services.bhavcopy_service.DownloadManager.download_bytes_for_date", return_value=mock_dl):
        resp_import = client.post(
            "/api/v1/ingestion/download-and-import",
            json={"trade_date": "2024-07-10", "force": True},
        )
        assert resp_import.status_code == 200
        import_data = resp_import.json()
        assert import_data["status"] == "success"
        assert import_data["records_inserted"] == 3

    # 3. List Ingestion Files endpoint
    resp_files = client.get("/api/v1/ingestion/files")
    assert resp_files.status_code == 200
    files_list = resp_files.json()
    assert len(files_list) >= 1
    file_names = [f["file_name"] for f in files_list]
    assert filename in file_names

    # 4. Check Dashboard summary includes total_records_count
    resp_dash = client.get("/api/v1/dashboard/summary")
    assert resp_dash.status_code == 200
    dash_data = resp_dash.json()
    assert dash_data["total_records_count"] >= 3
    assert dash_data["latest_job"] is not None

