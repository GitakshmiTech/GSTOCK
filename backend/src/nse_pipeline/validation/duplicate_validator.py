"""Batch duplicate validator."""

from typing import Any

from nse_pipeline.core.constants import SeverityLevel


class DuplicateValidator:
    @classmethod
    def find_and_deduplicate(
        cls,
        records: list[dict[str, Any]],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Identifies duplicate records in a batch and keeps the last occurrence."""
        seen: set[tuple[str, str, Any]] = set()
        deduped: list[dict[str, Any]] = []
        issues: list[dict[str, Any]] = []

        # Process in reverse to keep latest, then restore order
        for rec in reversed(records):
            key = (rec["symbol"], rec["series"], rec["trade_date"])
            if key in seen:
                issues.append({
                    "rule_name": "DUPLICATE_SOURCE_RECORD",
                    "severity": SeverityLevel.WARNING,
                    "trade_date": rec["trade_date"],
                    "symbol": rec["symbol"],
                    "series": rec["series"],
                    "details": f"Duplicate record encountered in source file for {key}",
                })
            else:
                seen.add(key)
                deduped.append(rec)

        deduped.reverse()
        return deduped, issues
