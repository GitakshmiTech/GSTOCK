"""GZIP decompressor and CSV parser."""

import gzip
from pathlib import Path

import pandas as pd

from nse_pipeline.core.exceptions import ParserError


class GzipParser:
    @staticmethod
    def read_csv_from_gzip(
        gzip_path: str | Path,
        encoding: str = "utf-8",
        delimiter: str = ",",
    ) -> pd.DataFrame:
        path = Path(gzip_path)
        try:
            with gzip.open(path, "rt", encoding=encoding) as f:
                return pd.read_csv(f, sep=delimiter, dtype=str)
        except UnicodeDecodeError:
            with gzip.open(path, "rt", encoding="latin1") as f:
                return pd.read_csv(f, sep=delimiter, dtype=str)
        except Exception as e:
            raise ParserError(f"Failed to parse gzip file {gzip_path}: {e}") from e
