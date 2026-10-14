"""Date normalization utilities."""

from datetime import date, datetime
from typing import Any

from dateutil import parser as dateutil_parser

from nse_pipeline.core.exceptions import NormalizationError


class DateNormalizer:
    @staticmethod
    def parse_to_date(val: Any) -> date | None:
        """Converts strings, timestamps, or date objects to a canonical datetime.date."""
        if val is None or (isinstance(val, float) and val != val):
            return None

        if isinstance(val, date) and not isinstance(val, datetime):
            return val

        if isinstance(val, datetime):
            return val.date()

        val_str = str(val).strip()
        if not val_str or val_str.upper() in ("NAN", "NULL", "NONE", "-"):
            return None

        # Known common formats
        common_formats = [
            "%d-%b-%Y",  # 05-JAN-2001
            "%d-%B-%Y",  # 05-January-2001
            "%Y-%m-%d",  # 2024-07-08
            "%d/%m/%Y",  # 05/01/2001
            "%Y%m%d",     # 20240708
        ]

        for fmt in common_formats:
            try:
                return datetime.strptime(val_str, fmt).date()
            except ValueError:
                continue

        # Fallback to dateutil
        try:
            return dateutil_parser.parse(val_str).date()
        except Exception as e:
            raise NormalizationError(f"Unable to parse date string '{val_str}': {e}") from e
