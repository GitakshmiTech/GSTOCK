"""Daily scheduler using APScheduler to trigger EOD ingestion at 4:00 PM IST."""

import signal
import sys
from datetime import timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import func, select

from nse_pipeline.core.clock import IST_TIMEZONE_STR, today_ist
from nse_pipeline.core.config import get_settings
from nse_pipeline.core.logging import get_logger
from nse_pipeline.database.models import StockDailyHistory
from nse_pipeline.database.session import get_db_session
from nse_pipeline.scheduler.trading_calendar import NSETradingCalendar
from nse_pipeline.services.daily_update_service import DailyUpdateService

logger = get_logger("scheduler.daily")

_background_scheduler: BackgroundScheduler | None = None


def catch_up_missing_trading_days() -> list[str]:
    """Scans for any missed past trading days and ingests them sequentially."""
    try:
        with get_db_session() as session:
            max_date = session.execute(select(func.max(StockDailyHistory.trade_date))).scalar_one_or_none()

        if not max_date:
            return []

        today = today_ist()
        current = max_date + timedelta(days=1)
        yesterday = today - timedelta(days=1)

        results = []
        service = DailyUpdateService()
        while current <= yesterday:
            if NSETradingCalendar.is_trading_day(current):
                logger.info(f"Catching up missed historical trading day: {current}")
                res = service.run_daily_update(target_date=current, force=True, wait_for_publication=False)
                results.append(f"{current}: {res.status}")
            current += timedelta(days=1)
        return results
    except Exception as e:
        logger.error(f"Error checking missed trading days: {e}", exc_info=True)
        return []


def scheduled_daily_eod_job():
    """Job function automatically executed at 4:00 PM IST every trading day."""
    logger.info("⏰ 4:00 PM IST Trigger: starting automated EOD market data ingestion workflow.")
    try:
        # 1. First catch up on any past missed trading days if any
        missed = catch_up_missing_trading_days()
        if missed:
            logger.info(f"Caught up on {len(missed)} missed past trading days: {missed}")

        # 2. Ingest today's EOD data with retry polling
        service = DailyUpdateService()
        result = service.run_daily_update(wait_for_publication=True)
        logger.info(f"Automated 4:00 PM job completed with status: {result.status}")
    except Exception as e:
        logger.error(f"Automated 4:00 PM daily update job failed with unhandled exception: {e}", exc_info=True)


def init_background_scheduler() -> BackgroundScheduler:
    """Initializes and starts the non-blocking background scheduler within FastAPI."""
    global _background_scheduler
    if _background_scheduler and _background_scheduler.running:
        return _background_scheduler

    settings = get_settings()
    hour, minute = settings.daily_update_time.split(":")

    _background_scheduler = BackgroundScheduler(timezone=IST_TIMEZONE_STR)
    trigger = CronTrigger(hour=int(hour), minute=int(minute), timezone=IST_TIMEZONE_STR)
    _background_scheduler.add_job(
        scheduled_daily_eod_job,
        trigger=trigger,
        id="nse_daily_eod_updater",
        name="NSE Daily EOD Update at 4:00 PM IST",
        replace_existing=True,
        misfire_grace_time=14400,  # 4-hour grace window if machine was sleeping
    )
    _background_scheduler.start()
    logger.info(f"NSE Daily Scheduler initialized. Automated trigger active for {settings.daily_update_time} IST every trading day.")
    return _background_scheduler


def get_scheduler_status() -> dict:
    """Returns current scheduler operational metrics."""
    settings = get_settings()
    global _background_scheduler
    is_running = bool(_background_scheduler and _background_scheduler.running)
    next_run = None
    if is_running and _background_scheduler:
        job = _background_scheduler.get_job("nse_daily_eod_updater")
        if job and job.next_run_time:
            next_run = job.next_run_time.strftime("%Y-%m-%d %H:%M:%S %Z")

    return {
        "status": "RUNNING" if is_running else "STOPPED",
        "configured_time": f"{settings.daily_update_time} IST",
        "timezone": IST_TIMEZONE_STR,
        "next_run_time": next_run or f"Today at {settings.daily_update_time} IST",
        "misfire_grace_hours": 4,
    }


def start_scheduler():
    """Starts the standalone blocking scheduler daemon."""
    settings = get_settings()
    hour, minute = settings.daily_update_time.split(":")

    scheduler = BlockingScheduler(timezone=IST_TIMEZONE_STR)
    trigger = CronTrigger(hour=int(hour), minute=int(minute), timezone=IST_TIMEZONE_STR)
    scheduler.add_job(
        scheduled_daily_eod_job,
        trigger=trigger,
        id="nse_daily_eod_updater",
        name="NSE Daily EOD Update at 4:00 PM IST",
        replace_existing=True,
        misfire_grace_time=14400,
    )

    logger.info(f"NSE Daily Scheduler started. Waiting for next trigger at {settings.daily_update_time} IST...")

    def shutdown(signum, frame):
        logger.info("Shutting down scheduler...")
        scheduler.shutdown(wait=False)
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        pass


if __name__ == "__main__":
    start_scheduler()
