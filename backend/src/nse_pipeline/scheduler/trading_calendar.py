"""NSE Market Trading Calendar and Holiday Manager."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from nse_pipeline.core.clock import daterange
from nse_pipeline.database.models import TradingCalendar


class NSETradingCalendar:
    """Manages trading sessions, holidays, weekends, and manual calendar overrides."""

    # Fixed annual holidays
    FIXED_HOLIDAYS = {
        (1, 26): "Republic Day",
        (5, 1): "Maharashtra Day / Labour Day",
        (8, 15): "Independence Day",
        (10, 2): "Mahatma Gandhi Jayanti",
        (12, 25): "Christmas",
    }

    @classmethod
    def is_weekend(cls, d: date) -> bool:
        """Returns True if the date falls on Saturday or Sunday."""
        return d.weekday() in (5, 6)

    @classmethod
    def get_known_holiday(cls, d: date) -> str | None:
        """Checks if date is a standard national fixed holiday."""
        return cls.FIXED_HOLIDAYS.get((d.month, d.day))

    @classmethod
    def is_trading_day(cls, d: date, session: Session | None = None) -> bool:
        """Determines whether a given date is an official trading day."""
        if cls.is_weekend(d):
            # Check if there is an exceptional special trading session (e.g. Muhurat trading)
            if session:
                stmt = select(TradingCalendar).where(TradingCalendar.trade_date == d)
                row = session.execute(stmt).scalar_one_or_none()
                if row and row.is_trading_day:
                    return True
            return False

        if cls.get_known_holiday(d):
            return False

        if session:
            stmt = select(TradingCalendar).where(TradingCalendar.trade_date == d)
            row = session.execute(stmt).scalar_one_or_none()
            if row:
                return row.is_trading_day

        return True

    @classmethod
    def get_trading_days(
        cls,
        start_date: date,
        end_date: date,
        session: Session | None = None,
    ) -> list[date]:
        """Returns all trading dates within [start_date, end_date]."""
        days = []
        for d in daterange(start_date, end_date):
            if cls.is_trading_day(d, session=session):
                days.append(d)
        return days

    @classmethod
    def seed_calendar(cls, session: Session, start_year: int = 2001, end_year: int = 2026) -> int:
        """Populates trading_calendar table with dates, weekends, and holidays."""
        start_date = date(start_year, 1, 1)
        end_date = date(end_year, 12, 31)

        count = 0
        for d in daterange(start_date, end_date):
            stmt = select(TradingCalendar).where(TradingCalendar.trade_date == d)
            existing = session.execute(stmt).scalar_one_or_none()
            if existing:
                continue

            weekend = cls.is_weekend(d)
            holiday_name = cls.get_known_holiday(d)
            is_holiday = holiday_name is not None
            is_trading = not weekend and not is_holiday

            cal_entry = TradingCalendar(
                trade_date=d,
                session_type="EQUITY",
                is_trading_day=is_trading,
                is_holiday=is_holiday,
                holiday_name=holiday_name,
                is_weekend=weekend,
            )
            session.add(cal_entry)
            count += 1
            if count % 1000 == 0:
                session.flush()

        session.flush()
        return count
