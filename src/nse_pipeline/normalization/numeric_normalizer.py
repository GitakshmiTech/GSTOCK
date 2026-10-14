"""Numeric parsing and cleanup utilities."""

from typing import Any


class NumericNormalizer:
    @staticmethod
    def parse_float(val: Any) -> float | None:
        """Converts strings/numbers into float, returning None if missing or blank."""
        if val is None or (isinstance(val, float) and val != val):
            return None

        val_str = str(val).strip().replace(",", "")
        if not val_str or val_str.upper() in ("NAN", "NULL", "NONE", "-", ""):
            return None

        try:
            return round(float(val_str), 6)
        except ValueError:
            return None

    @staticmethod
    def parse_int(val: Any) -> int | None:
        """Converts strings/numbers into integer, returning None if missing or blank."""
        if val is None or (isinstance(val, float) and val != val):
            return None

        val_str = str(val).strip().replace(",", "")
        if not val_str or val_str.upper() in ("NAN", "NULL", "NONE", "-", ""):
            return None

        try:
            # Handle possible float representations like '100.0'
            return int(float(val_str))
        except ValueError:
            return None
