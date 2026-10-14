"""Service coordinating official NSE Bhavcopy in-memory download and idempotent database ingestion."""

import time
import uuid
from contextlib import contextmanager
from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session


from nse_pipeline.core.clock import now_ist, today_ist
from nse_pipeline.core.constants import FileStatus, JobStatus, JobType
from nse_pipeline.core.logging import get_logger
from nse_pipeline.database.repositories.ingestion_repository import IngestionRepository
from nse_pipeline.database.session import get_db_session
from nse_pipeline.downloader.archive_resolver import ArchiveResolver
from nse_pipeline.downloader.download_manager import DownloadManager
from nse_pipeline.scheduler.job_lock import acquire_job_lock
from nse_pipeline.scheduler.trading_calendar import NSETradingCalendar
from nse_pipeline.services.ingestion_service import IngestionResult, IngestionService

logger = get_logger("services.bhavcopy_service")


def get_latest_market_trading_date(session: Session | None = None) -> date:
    """Returns the most recent trading date with an expected published Bhavcopy."""
    current_dt = now_ist()
    today = current_dt.date()

    # If today is a trading day and current time >= 16:00 IST, today is eligible
    if NSETradingCalendar.is_trading_day(today, session=session) and current_dt.hour >= 16:
        return today

    # Otherwise step back day by day until a trading day is found
    candidate = today - timedelta(days=1)
    for _ in range(30):
        if NSETradingCalendar.is_trading_day(candidate, session=session):
            return candidate
        candidate -= timedelta(days=1)

    return today - timedelta(days=1)


class BhavcopyService:
    def __init__(self, session: Session | None = None):
        self._external_session = session
        self.download_manager = DownloadManager()

    @contextmanager
    def _get_active_session(self):
        if self._external_session is not None:
            yield self._external_session
        else:
            with get_db_session() as session:
                yield session

    def download_and_import(
        self,
        target_date: date | None = None,
        force: bool = False,
    ) -> dict[str, Any]:
        """Downloads official NSE Bhavcopy in-memory and idempotently imports it into database."""
        start_time = time.time()

        if target_date is None:
            target_date = get_latest_market_trading_date()

        # Disallow future dates
        current_today = today_ist()
        if target_date > current_today:
            return {
                "status": "failed",
                "trade_date": str(target_date),
                "file_name": "N/A",
                "source_url": None,
                "source_format": None,
                "records_downloaded": 0,
                "records_parsed": 0,
                "records_inserted": 0,
                "records_updated": 0,
                "records_skipped": 0,
                "records_rejected": 0,
                "execution_time_seconds": round(time.time() - start_time, 2),
                "message": f"Cannot import future date: {target_date}. Today is {current_today}.",
                "error_details": f"Requested date {target_date} is in the future.",
            }

        # Check trading calendar
        if not force and not NSETradingCalendar.is_trading_day(target_date):
            holiday_name = NSETradingCalendar.get_known_holiday(target_date)
            reason = f"Exchange Holiday ({holiday_name})" if holiday_name else "Weekend"
            return {
                "status": "skipped",
                "trade_date": str(target_date),
                "file_name": "N/A",
                "source_url": None,
                "source_format": None,
                "records_downloaded": 0,
                "records_parsed": 0,
                "records_inserted": 0,
                "records_updated": 0,
                "records_skipped": 0,
                "records_rejected": 0,
                "execution_time_seconds": round(time.time() - start_time, 2),
                "message": f"{target_date} is not an official NSE trading day ({reason}). Use 'force' to override.",
                "error_details": None,
            }

        job_id = f"import_{target_date.strftime('%Y%m%d')}_{uuid.uuid4().hex[:6]}"

        with acquire_job_lock("bhavcopy_import", timeout_seconds=15):
            expected_filename = ArchiveResolver.resolve_filename(target_date)
            source_format = ArchiveResolver.get_source_format_for_date(target_date)

            logger.info(f"Triggering Bhavcopy download & import for {target_date} (Job: {job_id})")

            # 1. Download in-memory
            dl_result = self.download_manager.download_bytes_for_date(target_date)
            if dl_result is None:
                err_msg = (
                    f"Official Bhavcopy report for {target_date} ({expected_filename}) is not available on NSE servers. "
                    f"For today's data, NSE usually publishes the final CM-UDiFF report after 16:00–18:00 IST."
                )
                logger.warning(err_msg)

                # Record failed job for visibility
                with self._get_active_session() as session:
                    ingestion_repo = IngestionRepository(session)
                    ingestion_repo.create_job(
                        job_id=job_id,
                        job_type=JobType.MANUAL,
                        start_date=target_date,
                        end_date=target_date,
                        total_dates=1,
                    )
                    ingestion_repo.update_job_status(
                        job_id=job_id,
                        status=JobStatus.FAILED,
                        successful_dates=0,
                        failed_dates=1,
                        error_message=err_msg,
                    )
                    session.commit()

                return {
                    "status": "failed",
                    "trade_date": str(target_date),
                    "file_name": expected_filename,
                    "source_url": None,
                    "source_format": source_format.value,
                    "records_downloaded": 0,
                    "records_parsed": 0,
                    "records_inserted": 0,
                    "records_updated": 0,
                    "records_skipped": 0,
                    "records_rejected": 0,
                    "execution_time_seconds": round(time.time() - start_time, 2),
                    "message": err_msg,
                    "error_details": f"File not found on NSE India servers for date {target_date}",
                }

            # 2. Ingest in-memory
            with self._get_active_session() as session:
                ingestion_repo = IngestionRepository(session)

                ingestion_repo.create_job(
                    job_id=job_id,
                    job_type=JobType.MANUAL,
                    start_date=target_date,
                    end_date=target_date,
                    total_dates=1,
                )

                service = IngestionService(session)
                res: IngestionResult = service.ingest_download_bytes_result(dl_result, job_id=job_id)

                elapsed = round(time.time() - start_time, 2)
                if res.status == FileStatus.IMPORTED:
                    ingestion_repo.update_job_status(
                        job_id=job_id,
                        status=JobStatus.SUCCESS,
                        successful_dates=1,
                        failed_dates=0,
                        total_rows=res.inserted_count + res.updated_count,
                    )
                    session.commit()

                    success_msg = (
                        f"Successfully imported {dl_result.file_name} for {target_date}: "
                        f"{res.inserted_count} new stocks inserted, {res.updated_count} updated, "
                        f"{res.rejected_count} rejected in {elapsed}s."
                    )
                    logger.info(success_msg)

                    return {
                        "status": "success",
                        "trade_date": str(target_date),
                        "file_name": dl_result.file_name,
                        "source_url": dl_result.source_url,
                        "source_format": res.source_format or dl_result.source_format.value,
                        "records_downloaded": res.raw_row_count,
                        "records_parsed": res.parsed_count,
                        "records_inserted": res.inserted_count,
                        "records_updated": res.updated_count,
                        "records_skipped": res.skipped_count,
                        "records_rejected": res.rejected_count,
                        "execution_time_seconds": elapsed,
                        "message": success_msg,
                        "error_details": None,
                    }
                else:
                    ingestion_repo.update_job_status(
                        job_id=job_id,
                        status=JobStatus.FAILED,
                        successful_dates=0,
                        failed_dates=1,
                        error_message=res.error_message,
                    )
                    session.commit()

                    logger.error(f"Ingestion failed for {target_date}: {res.error_message}")
                    return {
                        "status": "failed",
                        "trade_date": str(target_date),
                        "file_name": dl_result.file_name,
                        "source_url": dl_result.source_url,
                        "source_format": dl_result.source_format.value,
                        "records_downloaded": res.raw_row_count,
                        "records_parsed": res.parsed_count,
                        "records_inserted": res.inserted_count,
                        "records_updated": res.updated_count,
                        "records_skipped": res.skipped_count,
                        "records_rejected": res.rejected_count,
                        "execution_time_seconds": elapsed,
                        "message": f"Failed to ingest Bhavcopy: {res.error_message}",
                        "error_details": res.error_message,
                    }
