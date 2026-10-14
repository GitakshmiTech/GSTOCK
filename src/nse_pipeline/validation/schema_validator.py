"""Schema and field type validator."""

from datetime import date
from typing import Any


class SchemaValidator:
    REQUIRED_FIELDS = ["trade_date", "symbol", "series", "close_price"]

    @classmethod
    def validate_record(cls, record: dict[str, Any]) -> tuple[bool, list[str]]:
        """Validates that all mandatory fields are present and correctly typed."""
        errors = []

        for field in cls.REQUIRED_FIELDS:
            if field not in record or record[field] is None:
                errors.append(f"Missing required field: '{field}'")

        if "trade_date" in record and record["trade_date"] is not None:
            if not isinstance(record["trade_date"], date):
                errors.append("Field 'trade_date' must be an instance of datetime.date")

        if "close_price" in record and record["close_price"] is not None:
            if not isinstance(record["close_price"], (int, float)):
                errors.append("Field 'close_price' must be numeric")

        return len(errors) == 0, errors
