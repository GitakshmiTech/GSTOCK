"""Unit tests for file checksum computation."""

from pathlib import Path

import pytest

from nse_pipeline.downloader.checksum import calculate_sha256


def test_calculate_sha256(tmp_path: Path):
    test_file = tmp_path / "sample.txt"
    test_file.write_text("Hello NSE Market Data Pipeline!", encoding="utf-8")

    checksum1 = calculate_sha256(test_file)
    assert len(checksum1) == 64

    # Recalculating produces identical hash
    checksum2 = calculate_sha256(test_file)
    assert checksum1 == checksum2

    # Modified content produces different hash
    test_file.write_text("Modified content", encoding="utf-8")
    checksum3 = calculate_sha256(test_file)
    assert checksum1 != checksum3


def test_checksum_file_not_found(tmp_path: Path):
    non_existent = tmp_path / "does_not_exist.txt"
    with pytest.raises(FileNotFoundError):
        calculate_sha256(non_existent)
