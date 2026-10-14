"""Unit tests for in-memory NSE Bhavcopy download, ZIP extraction, and parsing."""

import io
import zipfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
import pytest

from nse_pipeline.clients.public_archive_client import PublicArchiveClient
from nse_pipeline.core.constants import SourceFormat
from nse_pipeline.core.exceptions import (
    ArchiveNotFoundError,
    DownloaderError,
    ParserError,
    UnsupportedFormatError,
)
from nse_pipeline.parsers.csv_parser import CsvParser
from nse_pipeline.parsers.legacy_bhavcopy import LegacyBhavcopyParser
from nse_pipeline.parsers.parser_factory import ParserFactory
from nse_pipeline.parsers.udiff_bhavcopy import UdiffBhavcopyParser
from nse_pipeline.parsers.zip_parser import ZipParser



def _make_zip_bytes(filename: str, content: str) -> bytes:
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(filename, content)
    return bio.getvalue()


def test_zip_parser_read_csv_from_bytes(udiff_sample_path: Path):
    content = udiff_sample_path.read_text(encoding="utf-8")
    zip_bytes = _make_zip_bytes("BhavCopy_NSE_CM_0_0_0_20240708_F_0000.csv", content)

    df = ZipParser.read_csv_from_bytes(zip_bytes)
    assert len(df) == 3
    assert "TckrSymb" in df.columns or "TCKRSYMB" in [c.upper() for c in df.columns]


def test_csv_parser_read_csv_from_bytes(udiff_sample_path: Path):
    csv_bytes = udiff_sample_path.read_bytes()
    df = CsvParser.read_csv_from_bytes(csv_bytes)
    assert len(df) == 3


def test_udiff_parser_parse_bytes(udiff_sample_path: Path):
    content = udiff_sample_path.read_text(encoding="utf-8")
    zip_bytes = _make_zip_bytes("BhavCopy_NSE_CM_0_0_0_20240708_F_0000.csv", content)

    parser = UdiffBhavcopyParser()
    df = parser.parse_bytes(zip_bytes, file_name="BhavCopy_NSE_CM_0_0_0_20240708_F_0000.csv.zip")
    assert len(df) == 3
    assert set(df["symbol"].tolist()) == {"RELIANCE", "TCS", "INFY"}
    assert "close_price" in df.columns
    assert "trade_date" in df.columns


def test_legacy_parser_parse_bytes(legacy_sample_path: Path):
    content = legacy_sample_path.read_text(encoding="utf-8")
    zip_bytes = _make_zip_bytes("cm05JAN2024bhav.csv", content)

    parser = LegacyBhavcopyParser()
    df = parser.parse_bytes(zip_bytes, file_name="cm05JAN2024bhav.csv.zip")
    assert len(df) == 4
    assert {"RELIANCE", "TCS", "INFY"}.issubset(set(df["symbol"].tolist()))



def test_parser_factory_detect_bytes():
    udiff_header = b"TradDt,BizDt,Sgmt,Src,FinInstrmTp,FinInstrmId,ISIN,TCKRSYMB,SCTYSRS,OPNPRIC,HGHPRIC,LWPRIC,CLSPRIC\n"
    zip_bytes = _make_zip_bytes("BhavCopy_NSE_CM_0_0_0_20240708_F_0000.csv", udiff_header.decode("utf-8"))

    parser = ParserFactory.get_parser_for_bytes(zip_bytes, filename="BhavCopy_NSE_CM_0_0_0_20240708_F_0000.csv.zip")
    assert isinstance(parser, UdiffBhavcopyParser)

    legacy_header = b"SYMBOL,SERIES,OPEN,HIGH,LOW,CLOSE,LAST,PREVCLOSE,TOTTRDQTY,TOTTRDVAL,TIMESTAMP,TOTALTRADES,ISIN\n"
    leg_zip_bytes = _make_zip_bytes("cm05JAN2024bhav.csv", legacy_header.decode("utf-8"))
    leg_parser = ParserFactory.get_parser_for_bytes(leg_zip_bytes, filename="cm05JAN2024bhav.csv.zip")
    assert isinstance(leg_parser, LegacyBhavcopyParser)


def test_empty_zip_bytes_error():
    bio = io.BytesIO()
    with zipfile.ZipFile(bio, "w", zipfile.ZIP_DEFLATED) as zf:
        pass  # Empty ZIP
    empty_zip_bytes = bio.getvalue()

    with pytest.raises(ParserError):
        ZipParser.read_csv_from_bytes(empty_zip_bytes)



def test_public_archive_client_download_bytes_mock():
    client = PublicArchiveClient()

    # Mock successful response
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.content = b"TEST_ARCHIVE_DATA"

    with patch.object(client, "_get_session") as mock_get_sess:
        mock_sess = MagicMock()
        mock_sess.get.return_value = mock_resp
        mock_get_sess.return_value = mock_sess

        res = client.download_bytes("https://archives.nseindia.com/test.zip")
        assert res == b"TEST_ARCHIVE_DATA"

    # Mock 404 response
    mock_404 = MagicMock()
    mock_404.status_code = 404
    with patch.object(client, "_get_session") as mock_get_sess:
        mock_sess = MagicMock()
        mock_sess.get.return_value = mock_404
        mock_get_sess.return_value = mock_sess

        with pytest.raises(ArchiveNotFoundError):
            client.download_bytes("https://archives.nseindia.com/nonexistent.zip")

    # Mock network connection error
    with patch.object(client, "_get_session") as mock_get_sess:
        mock_sess = MagicMock()
        mock_sess.get.side_effect = httpx.ConnectTimeout("Connection timed out")
        mock_get_sess.return_value = mock_sess

        with pytest.raises(DownloaderError):
            client.download_bytes("https://archives.nseindia.com/timeout.zip")
