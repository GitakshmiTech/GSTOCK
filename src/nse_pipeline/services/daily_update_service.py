"""Service executing the automated End-of-Day (EOD) ingestion at 4:00 PM IST."""

import time
import uuid
from datetime import date

from sqlalchemy.orm import Session

from nse_pipeline.core.clock import today_ist
from nse_pipeline.core.config import get_settings
from nse_pipeline.core.constants import FileStatus, JobStatus, JobType
from nse_pipeline.core.logging import get_logger
from nse_pipeline.database.repositories.ingestion_repository import IngestionRepository
from nse_pipeline.database.session import get_db_session
from nse_pipeline.downloader.download_manager import DownloadManager
from nse_pipeline.notifications.alert_manager import AlertManager
from nse_pipeline.scheduler.job_lock import acquire_job_lock
from nse_pipeline.scheduler.trading_calendar import NSETradingCalendar
from nse_pipeline.services.ingestion_service import IngestionResult, IngestionService

logger = get_logger("services.daily_update")


class DailyUpdateService:
    def __init__(self, session: Session | None = None):
        self._external_session = session
        self.settings = get_settings()
        self.download_manager = DownloadManager()
        self.alert_manager = AlertManager()

    def run_daily_update(
        self,
        target_date: date | None = None,
        force: bool = False,
        wait_for_publication: bool = True,
    ) -> IngestionResult:
        """Executes the daily EOD market data update workflow."""
        run_date = target_date or today_ist()
        job_id = f"daily_{run_date.strftime('%Y%m%d')}_{uuid.uuid4().hex[:6]}"

        with acquire_job_lock("daily_update", timeout_seconds=10):
            # Check calendar
            if not NSETradingCalendar.is_trading_day(run_date) and not force:
                logger.info(f"{run_date} is a non-trading day (weekend or exchange holiday). Skipping update.")
                return IngestionResult(
                    trade_date=run_date,
                    file_name="N/A",
                    status=FileStatus.SKIPPED,
                    error_message=f"{run_date} is not a trading day.",
                )

            logger.info(f"Initiating daily EOD update for {run_date} (Job: {job_id})")

            # Polling retry loop for file availability
            max_wait_seconds = self.settings.daily_retry_max_wait_minutes * 60 if wait_for_publication else 0
            poll_interval = self.settings.daily_retry_initial_seconds
            start_poll_time = time.time()
            dl_result = None

            while True:
                dl_result = self.download_manager.download_for_date(run_date, force_redownload=force)
                if dl_result is not None:
                    break

                elapsed = time.time() - start_poll_time
                if elapsed >= max_wait_seconds:
                    err_msg = (
                        f"Official EOD Bhavcopy for {run_date} was not published within "
                        f"{self.settings.daily_retry_max_wait_minutes} minutes."
                    )
                    logger.error(err_msg)
                    self.alert_manager.send_failure_alert(job_id, JobType.DAILY, err_msg)
                    return IngestionResult(
                        trade_date=run_date,
                        file_name="N/A",
                        status=FileStatus.FAILED,
                        error_message=err_msg,
                    )

                logger.info(
                    f"EOD file not yet published. Retrying in {poll_interval}s... "
                    f"({int(elapsed)}s / {max_wait_seconds}s elapsed)"
                )
                time.sleep(poll_interval)
                # Exponential backoff capped at max_retry_seconds
                poll_interval = min(poll_interval * 2, self.settings.daily_retry_max_seconds)

            # Ingest downloaded file
            with get_db_session() as session:
                ingestion_repo = IngestionRepository(session)
                ingestion_repo.create_job(
                    job_id=job_id,
                    job_type=JobType.DAILY,
                    start_date=run_date,
                    end_date=run_date,
                    total_dates=1,
                )

                service = IngestionService(session)
                result = service.ingest_download_result(dl_result, job_id=job_id)

                if result.status == FileStatus.IMPORTED:
                    ingestion_repo.update_job_status(
                        job_id=job_id,
                        status=JobStatus.SUCCESS,
                        successful_dates=1,
                        failed_dates=0,
                        total_rows=result.inserted_count,
                    )
                    logger.info(f"Daily update completed successfully for {run_date}. Inserted {result.inserted_count} rows.")
                else:
                    ingestion_repo.update_job_status(
                        job_id=job_id,
                        status=JobStatus.FAILED,
                        successful_dates=0,
                        failed_dates=1,
                        error_message=result.error_message,
                    )
                    self.alert_manager.send_failure_alert(job_id, JobType.DAILY, result.error_message or "Unknown failure")

                return result
