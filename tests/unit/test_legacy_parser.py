"""Unit tests for Legacy Bhavcopy parser."""

from pathlib import Path

from nse_pipeline.core.constants import SourceFormat
from nse_pipeline.parsers.legacy_bhavcopy import LegacyBhavcopyParser
from nse_pipeline.parsers.parser_factory import ParserFactory


def test_parse_legacy_csv(legacy_sample_path: Path):
    parser = LegacyBhavcopyParser()
    assert parser.format_name == SourceFormat.LEGACY_BHAVCOPY
    assert parser.version == "1.0.0"

    df = parser.parse(legacy_sample_path)
    assert len(df) == 4
    assert "symbol" in df.columns
    assert "series" in df.columns
    assert "close_price" in df.columns
    assert "trade_date" in df.columns

    symbols = set(df["symbol"].tolist())
    assert "RELIANCE" in symbols
    assert "TCS" in symbols
    assert "INFY" in symbols
    assert "HDFCBANK" in symbols


def test_parse_legacy_zip(legacy_zip_path: Path):
    parser = ParserFactory.get_parser(legacy_zip_path)
    assert isinstance(parser, LegacyBhavcopyParser)

    df = parser.parse(legacy_zip_path)
    assert len(df) == 4
    assert df.iloc[0]["symbol"] == "RELIANCE"
    assert df.iloc[0]["series"] == "EQ"
