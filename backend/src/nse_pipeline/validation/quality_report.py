"""Validation quality report and batch filtration engine."""

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from nse_pipeline.core.constants import SeverityLevel
from nse_pipeline.validation.duplicate_validator import DuplicateValidator
from nse_pipeline.validation.price_validator import PriceValidator
from nse_pipeline.validation.schema_validator import SchemaValidator


@dataclass
class ValidationReport:
    trade_date: date
    total_records: int = 0
    valid_records: int = 0
    rejected_records: int = 0
    warning_count: int = 0
    error_count: int = 0
    issues: list[dict[str, Any]] = field(default_factory=list)


class QualityReportEngine:
    @classmethod
    def validate_batch(
        cls,
        records: list[dict[str, Any]],
        trade_date: date,
    ) -> tuple[list[dict[str, Any]], ValidationReport]:
        """Validates all records in batch, rejecting records with critical/error issues."""
        report = ValidationReport(trade_date=trade_date, total_records=len(records))

        # 1. Deduplicate batch
        deduped_records, dup_issues = DuplicateValidator.find_and_deduplicate(records)
        report.issues.extend(dup_issues)
        report.warning_count += len(dup_issues)

        valid_list: list[dict[str, Any]] = []

        for rec in deduped_records:
            # Schema validation
            is_schema_valid, schema_errors = SchemaValidator.validate_record(rec)
            if not is_schema_valid:
                report.rejected_records += 1
                report.error_count += len(schema_errors)
                for err in schema_errors:
                    report.issues.append({
                        "trade_date": trade_date,
                        "symbol": rec.get("symbol"),
                        "series": rec.get("series"),
                        "rule_name": "SCHEMA_VALIDATION_ERROR",
                        "severity": SeverityLevel.ERROR,
                        "details": err,
                    })
                continue

            # Price and domain rules
            price_issues = PriceValidator.validate_price_record(rec)
            has_error = False
            for issue in price_issues:
                issue["trade_date"] = trade_date
                issue["symbol"] = rec.get("symbol")
                issue["series"] = rec.get("series")
                report.issues.append(issue)

                if issue["severity"] in (SeverityLevel.ERROR, SeverityLevel.CRITICAL):
                    has_error = True
                    report.error_count += 1
                else:
                    report.warning_count += 1

            if has_error:
                report.rejected_records += 1
            else:
                valid_list.append(rec)
                report.valid_records += 1

        return valid_list, report
