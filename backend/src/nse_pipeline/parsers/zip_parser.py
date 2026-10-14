"""ZIP archive parser utility."""

import zipfile
from pathlib import Path

import pandas as pd

from nse_pipeline.core.exceptions import ParserError


class ZipParser:
    @staticmethod
    def read_csv_from_zip(
        zip_path: str | Path,
        encoding: str = "utf-8",
        delimiter: str = ",",
    ) -> pd.DataFrame:
        """Finds the primary CSV file inside the zip archive and loads it into a DataFrame."""
        path = Path(zip_path)
        if not zipfile.is_zipfile(path):
            raise ParserError(f"Provided path is not a valid zip archive: {zip_path}")

        with zipfile.ZipFile(path, "r") as zf:
            csv_names = [name for name in zf.namelist() if name.lower().endswith(".csv")]
            if not csv_names:
                raise ParserError(f"No CSV file found inside zip archive: {zip_path}")

            # Pick the primary CSV file
            target_csv = csv_names[0]
            with zf.open(target_csv) as f:
                try:
                    return pd.read_csv(f, encoding=encoding, sep=delimiter, dtype=str)
                except UnicodeDecodeError:
                    # Retry with latin1 fallback
                    f.seek(0)
                    return pd.read_csv(f, encoding="latin1", sep=delimiter, dtype=str)

    @staticmethod
    def read_csv_from_bytes(
        data: bytes,
        encoding: str = "utf-8",
        delimiter: str = ",",
    ) -> pd.DataFrame:
        """Parses CSV directly from in-memory ZIP bytes without disk writes."""
        import io

        bio = io.BytesIO(data)
        if not zipfile.is_zipfile(bio):
            raise ParserError("Provided byte data is not a valid zip archive")

        with zipfile.ZipFile(bio, "r") as zf:
            csv_names = [name for name in zf.namelist() if name.lower().endswith(".csv")]
            if not csv_names:
                raise ParserError("No CSV file found inside zip archive")

            target_csv = csv_names[0]
            with zf.open(target_csv) as f:
                try:
                    return pd.read_csv(f, encoding=encoding, sep=delimiter, dtype=str)
                except UnicodeDecodeError:
                    f.seek(0)
                    return pd.read_csv(f, encoding="latin1", sep=delimiter, dtype=str)

    @staticmethod
    def list_files(zip_path: str | Path) -> list[str]:
        with zipfile.ZipFile(zip_path, "r") as zf:
            return zf.namelist()
