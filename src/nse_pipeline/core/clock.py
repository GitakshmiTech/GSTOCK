"""Time and timezone utilities for the NSE Market Data Pipeline."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

IST_TIMEZONE_STR = "Asia/Kolkata"
IST = ZoneInfo(IST_TIMEZONE_STR)


def now_ist() -> datetime:
    """Returns the current datetime in IST (Asia/Kolkata)."""
    return datetime.now(IST)


def today_ist() -> date:
    """Returns today's date in IST."""
    return now_ist().date()


def is_market_eod_time(target_hour: int = 16, target_minute: int = 0) -> bool:
    """Checks whether the current IST time is at or past the scheduled EOD trigger time."""
    current = now_ist()
    target_time = time(hour=target_hour, minute=target_minute)
    return current.time() >= target_time


def parse_date(date_str: str) -> date:
    """Parses an ISO format date string (YYYY-MM-DD) into a date object."""
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def format_date_iso(d: date) -> str:
    """Formats a date object as YYYY-MM-DD."""
    return d.strftime("%Y-%m-%d")


def daterange(start_date: date, end_date: date):
    """Yields each date between start_date and end_date (inclusive)."""
    current = start_date
    while current <= end_date:
        yield current
        current += timedelta(days=1)
