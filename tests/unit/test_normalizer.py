"""Unit tests for Normalization layer."""

from datetime import date

import pandas as pd

from nse_pipeline.normalization.date_normalizer import DateNormalizer
from nse_pipeline.normalization.normalizer import Normalizer
from nse_pipeline.normalization.numeric_normalizer import NumericNormalizer
from nse_pipeline.normalization.symbol_normalizer import SymbolNormalizer


def test_date_normalizer():
    # Legacy format 05-JAN-2024
    assert DateNormalizer.parse_to_date("05-JAN-2024") == date(2024, 1, 5)
    # UDiFF format 2024-07-08
    assert DateNormalizer.parse_to_date("2024-07-08") == date(2024, 7, 8)
    # Blank or nan returns None
    assert DateNormalizer.parse_to_date("") is None
    assert DateNormalizer.parse_to_date("NAN") is None
    assert DateNormalizer.parse_to_date(None) is None


def test_numeric_normalizer():
    assert NumericNormalizer.parse_float("1,234.56") == 1234.56
    assert NumericNormalizer.parse_float("  500.25 ") == 500.25
    assert NumericNormalizer.parse_float("") is None
    assert NumericNormalizer.parse_float("-") is None
    assert NumericNormalizer.parse_float("NA") is None

    assert NumericNormalizer.parse_int("10,000") == 10000
    assert NumericNormalizer.parse_int("500.0") == 500
    assert NumericNormalizer.parse_int("") is None


def test_symbol_normalizer():
    assert SymbolNormalizer.normalize_symbol(" reliance ") == "RELIANCE"
    assert SymbolNormalizer.normalize_series(" eq ") == "EQ"
    assert SymbolNormalizer.normalize_series("") == "EQ"
    assert SymbolNormalizer.normalize_isin("ine002a01018") == "INE002A01018"
    assert SymbolNormalizer.normalize_isin("invalid") is None


def test_normalizer_vwap_calculation():
    df = pd.DataFrame([{
        "symbol": "TCS",
        "series": "EQ",
        "trade_date": "2024-01-05",
        "open_price": "3800.0",
        "high_price": "3850.0",
        "low_price": "3790.0",
        "close_price": "3840.0",
        "prev_close": "3810.0",
        "traded_quantity": "1000",
        "turnover": "3820000.0",
        "vwap": None,
    }])
    records = Normalizer.normalize_records(df)
    assert len(records) == 1
    # VWAP = turnover / volume = 3820000 / 1000 = 3820.0
    assert records[0]["vwap"] == 3820.0
