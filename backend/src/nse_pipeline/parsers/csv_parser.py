"""Generic robust CSV file reader."""

from pathlib import Path

import pandas as pd

from nse_pipeline.core.exceptions import ParserError


class CsvParser:
    @staticmethod
    def read_csv(
        csv_path: str | Path,
        encoding: str = "utf-8",
        delimiter: str = ",",
    ) -> pd.DataFrame:
        path = Path(csv_path)
        try:
            return pd.read_csv(path, encoding=encoding, sep=delimiter, dtype=str)
        except UnicodeDecodeError:
            return pd.read_csv(path, encoding="latin1", sep=delimiter, dtype=str)
        except Exception as e:
            raise ParserError(f"Failed to read CSV file {csv_path}: {e}") from e

    @staticmethod
    def read_csv_from_bytes(
        data: bytes,
        encoding: str = "utf-8",
        delimiter: str = ",",
    ) -> pd.DataFrame:
        import io
        try:
            return pd.read_csv(io.BytesIO(data), encoding=encoding, sep=delimiter, dtype=str)
        except UnicodeDecodeError:
            return pd.read_csv(io.BytesIO(data), encoding="latin1", sep=delimiter, dtype=str)
        except Exception as e:
            raise ParserError(f"Failed to read in-memory CSV: {e}") from e
