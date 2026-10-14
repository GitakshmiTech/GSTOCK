"""Parser for UDiFF Common Bhavcopy archives (from July 8, 2024 onwards)."""

from pathlib import Path

import pandas as pd

from nse_pipeline.core.constants import SourceFormat
from nse_pipeline.parsers.base_parser import BaseParser
from nse_pipeline.parsers.column_mapper import ColumnMapper
from nse_pipeline.parsers.csv_parser import CsvParser
from nse_pipeline.parsers.gzip_parser import GzipParser
from nse_pipeline.parsers.zip_parser import ZipParser


class UdiffBhavcopyParser(BaseParser):
    @property
    def format_name(self) -> SourceFormat:
        return SourceFormat.UDIFF_BHAVCOPY

    @property
    def version(self) -> str:
        return "2.0.0"

    def _post_process(self, df: pd.DataFrame) -> pd.DataFrame:
        # Map to canonical schema
        mapped_df = ColumnMapper.map_columns(df, SourceFormat.UDIFF_BHAVCOPY)

        # Filter to Capital Market cash segment if segment present
        if "segment" in mapped_df.columns:
            mapped_df = mapped_df[
                mapped_df["segment"].astype(str).str.strip().str.upper().isin(["CM", "NAN", ""])
            ]

        # Filter to equity instruments (stocks, ETFs)
        if "fin_instrm_tp" in mapped_df.columns:
            valid_types = ["STK", "ETF", "GB", "NAN", ""]
            mapped_df = mapped_df[
                mapped_df["fin_instrm_tp"].astype(str).str.strip().str.upper().isin(valid_types)
            ]

        # Trim symbols and series
        for col in ["symbol", "series", "isin"]:
            if col in mapped_df.columns:
                mapped_df[col] = mapped_df[col].astype(str).str.strip().str.upper()

        if "series" not in mapped_df.columns:
            mapped_df["series"] = "EQ"
        else:
            mapped_df["series"] = mapped_df["series"].replace({"NAN": "EQ", "": "EQ"}).fillna("EQ")

        # Strictly filter to Equity (Mainboard & SME) series
        allowed_series = ["EQ", "BE", "BZ", "SM", "ST", "SZ"]
        mapped_df = mapped_df[mapped_df["series"].isin(allowed_series)]

        return mapped_df

    def parse(self, file_path: str | Path) -> pd.DataFrame:
        """Parses a UDiFF Common Bhavcopy CSV or ZIP file into a normalized DataFrame."""
        path = Path(file_path)
        name_lower = path.name.lower()

        if name_lower.endswith(".zip"):
            df = ZipParser.read_csv_from_zip(path)
        elif name_lower.endswith(".gz"):
            df = GzipParser.read_csv_from_gzip(path)
        else:
            df = CsvParser.read_csv(path)

        return self._post_process(df)

    def parse_bytes(self, data: bytes, file_name: str) -> pd.DataFrame:
        """Parses a UDiFF Common Bhavcopy directly from in-memory byte buffer without saving to disk."""
        name_lower = file_name.lower()

        if name_lower.endswith(".zip"):
            df = ZipParser.read_csv_from_bytes(data)
        else:
            df = CsvParser.read_csv_from_bytes(data)

        return self._post_process(df)
