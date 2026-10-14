"""Unit tests for modern UDiFF Bhavcopy parser."""

from pathlib import Path

from nse_pipeline.core.constants import SourceFormat
from nse_pipeline.parsers.parser_factory import ParserFactory
from nse_pipeline.parsers.udiff_bhavcopy import UdiffBhavcopyParser


def test_parse_udiff_csv(udiff_sample_path: Path):
    parser = UdiffBhavcopyParser()
    assert parser.format_name == SourceFormat.UDIFF_BHAVCOPY
    assert parser.version == "2.0.0"

    df = parser.parse(udiff_sample_path)
    assert len(df) == 3
    assert "symbol" in df.columns
    assert "close_price" in df.columns
    assert "trade_date" in df.columns

    symbols = set(df["symbol"].tolist())
    assert "RELIANCE" in symbols
    assert "TCS" in symbols
    assert "INFY" in symbols


def test_parse_udiff_zip(udiff_zip_path: Path):
    parser = ParserFactory.get_parser(udiff_zip_path)
    assert isinstance(parser, UdiffBhavcopyParser)

    df = parser.parse(udiff_zip_path)
    assert len(df) == 3
    assert df.iloc[0]["symbol"] == "RELIANCE"
    assert df.iloc[0]["series"] == "EQ"
