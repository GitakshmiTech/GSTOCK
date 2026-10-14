from contextlib import contextmanager
from datetime import date
import pytest
from sqlalchemy.orm import Session

from nse_pipeline.core.constants import FileStatus
from nse_pipeline.scheduler.trading_calendar import NSETradingCalendar
from nse_pipeline.services.daily_update_service import DailyUpdateService


@contextmanager
def noop_lock(*args, **kwargs):
    yield None


def test_daily_update_weekend_skip(test_db_session: Session, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("nse_pipeline.services.daily_update_service.acquire_job_lock", noop_lock)
    service = DailyUpdateService(session=test_db_session)
    # 2024-07-07 was Sunday
    sunday = date(2024, 7, 7)
    assert NSETradingCalendar.is_trading_day(sunday) is False

    result = service.run_daily_update(target_date=sunday, force=False)
    assert result.status == FileStatus.SKIPPED


def test_daily_update_holiday_skip(test_db_session: Session, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr("nse_pipeline.services.daily_update_service.acquire_job_lock", noop_lock)
    service = DailyUpdateService(session=test_db_session)
    # Independence Day
    independence_day = date(2024, 8, 15)
    assert NSETradingCalendar.is_trading_day(independence_day) is False

    result = service.run_daily_update(target_date=independence_day, force=False)
    assert result.status == FileStatus.SKIPPED
