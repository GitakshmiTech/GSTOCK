"""Unit tests for Validation and Quality checks."""

from datetime import date

from nse_pipeline.core.constants import SeverityLevel
from nse_pipeline.validation.duplicate_validator import DuplicateValidator
from nse_pipeline.validation.price_validator import PriceValidator
from nse_pipeline.validation.schema_validator import SchemaValidator


def test_schema_validator():
    valid_record = {
        "trade_date": date(2024, 1, 5),
        "symbol": "RELIANCE",
        "series": "EQ",
        "close_price": 2972.10,
    }
    is_valid, errors = SchemaValidator.validate_record(valid_record)
    assert is_valid is True
    assert len(errors) == 0

    invalid_record = {
        "symbol": "RELIANCE",
        # missing trade_date, series, close_price
    }
    is_valid, errors = SchemaValidator.validate_record(invalid_record)
    assert is_valid is False
    assert len(errors) >= 3


def test_price_validator_negative_and_logic():
    # Record with negative price
    rec = {
        "open_price": -100.0,
        "high_price": 100.0,
        "low_price": 50.0,
        "close_price": 80.0,
        "prev_close": 75.0,
    }
    issues = PriceValidator.validate_price_record(rec)
    assert any(i["rule_name"] == "NON_POSITIVE_OPEN_PRICE" for i in issues)

    # Record with High < Low
    rec2 = {
        "open_price": 100.0,
        "high_price": 80.0,
        "low_price": 120.0,
        "close_price": 90.0,
        "prev_close": 95.0,
    }
    issues2 = PriceValidator.validate_price_record(rec2)
    assert any(i["rule_name"] == "HIGH_LESS_THAN_LOW" for i in issues2)


def test_price_validator_extreme_swing():
    # 50% price jump
    rec = {
        "open_price": 150.0,
        "high_price": 160.0,
        "low_price": 140.0,
        "close_price": 150.0,
        "prev_close": 100.0,
    }
    issues = PriceValidator.validate_price_record(rec)
    extreme = [i for i in issues if i["rule_name"] == "EXTREME_PRICE_SWING"]
    assert len(extreme) == 1
    assert extreme[0]["severity"] == SeverityLevel.WARNING


def test_duplicate_validator():
    records = [
        {"trade_date": date(2024, 1, 5), "symbol": "INFY", "series": "EQ", "close_price": 1500.0},
        {"trade_date": date(2024, 1, 5), "symbol": "INFY", "series": "EQ", "close_price": 1520.0}, # duplicate
        {"trade_date": date(2024, 1, 5), "symbol": "TCS", "series": "EQ", "close_price": 3800.0},
    ]
    deduped, dup_issues = DuplicateValidator.find_and_deduplicate(records)
    assert len(deduped) == 2
    assert len(dup_issues) == 1
    # Check that latest duplicate is preserved
    infy = next(r for r in deduped if r["symbol"] == "INFY")
    assert infy["close_price"] == 1520.0
