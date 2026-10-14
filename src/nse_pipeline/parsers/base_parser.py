"""Base parser interface for NSE market data files."""

from abc import ABC, abstractmethod
from pathlib import Path

import pandas as pd

from nse_pipeline.core.constants import SourceFormat


class BaseParser(ABC):
    """Abstract base class for all file parsers."""

    @property
    @abstractmethod
    def format_name(self) -> SourceFormat:
        """Returns the format enum corresponding to this parser."""

    @property
    @abstractmethod
    def version(self) -> str:
        """Returns the parser version string."""

    @abstractmethod
    def parse(self, file_path: str | Path) -> pd.DataFrame:
        """Parses the input file into a raw pandas DataFrame."""
