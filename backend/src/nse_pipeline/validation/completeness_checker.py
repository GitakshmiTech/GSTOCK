"""Completeness checker for trading days and row count consistency."""

from datetime import date

from sqlalchemy.orm import Session

from nse_pipeline.database.repositories.price_repository import PriceRepository


class CompletenessChecker:
    @staticmethod
    def find_missing_trading_dates(
        session: Session,
        expected_trading_dates: list[date],
    ) -> list[date]:
        """Compares expected trading dates against dates present in the database."""
        price_repo = PriceRepository(session)
        if not expected_trading_dates:
            return []

        start_date = min(expected_trading_dates)
        end_date = max(expected_trading_dates)

        actual_dates: set[date] = set(price_repo.get_distinct_dates(start_date=start_date, end_date=end_date))
        missing = [d for d in expected_trading_dates if d not in actual_dates]
        return sorted(missing)
