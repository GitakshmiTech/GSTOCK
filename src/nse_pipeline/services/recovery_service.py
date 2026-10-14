"""Recovery and reconciliation service for missing dates and failed imports."""

from datetime import date

from sqlalchemy.orm import Session

from nse_pipeline.core.logging import get_logger
from nse_pipeline.database.repositories.ingestion_repository import IngestionRepository
from nse_pipeline.database.repositories.price_repository import PriceRepository
from nse_pipeline.scheduler.trading_calendar import NSETradingCalendar
from nse_pipeline.services.backfill_service import BackfillService, BackfillSummary
from nse_pipeline.validation.completeness_checker import CompletenessChecker

logger = get_logger("services.recovery")


class RecoveryService:
    def __init__(self, session: Session):
        self.session = session
        self.price_repo = PriceRepository(session)
        self.ingestion_repo = IngestionRepository(session)

    def reconcile_missing_dates(self, start_date: date, end_date: date) -> list[date]:
        """Finds all official trading dates in the given window that have no price data."""
        expected = NSETradingCalendar.get_trading_days(start_date, end_date)
        missing = CompletenessChecker.find_missing_trading_dates(self.session, expected)
        logger.info(f"Reconciliation: found {len(missing)} missing trading dates between {start_date} and {end_date}.")
        return missing

    def recover_missing_dates(self, start_date: date, end_date: date) -> BackfillSummary:
        """Triggers targeted recovery ingestion for any missing dates."""
        missing = self.reconcile_missing_dates(start_date, end_date)
        if not missing:
            logger.info("All trading dates present. No recovery needed.")
            return BackfillSummary(
                job_id="recovery_none",
                start_date=start_date,
                end_date=end_date,
            )

        backfill_svc = BackfillService()
        return backfill_svc.run_backfill(
            start_date=min(missing),
            end_date=max(missing),
            resume=True,
        )
