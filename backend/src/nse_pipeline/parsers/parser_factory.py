"""Factory for instantiating the appropriate parser for any given archive file."""

import re
import zipfile
from pathlib import Path

from nse_pipeline.core.constants import SourceFormat
from nse_pipeline.core.exceptions import UnsupportedFormatError
from nse_pipeline.parsers.base_parser import BaseParser
from nse_pipeline.parsers.legacy_bhavcopy import LegacyBhavcopyParser
from nse_pipeline.parsers.udiff_bhavcopy import UdiffBhavcopyParser


class ParserFactory:
    @classmethod
    def get_parser(
        cls,
        file_path: str | Path,
        format_hint: SourceFormat | None = None,
    ) -> BaseParser:
        """Determines and returns the appropriate parser for the file."""
        if format_hint == SourceFormat.LEGACY_BHAVCOPY:
            return LegacyBhavcopyParser()
        if format_hint == SourceFormat.UDIFF_BHAVCOPY:
            return UdiffBhavcopyParser()

        path = Path(file_path)
        filename = path.name

        # Filename regex matching
        if re.search(r"^BhavCopy_NSE_CM", filename, re.IGNORECASE):
            return UdiffBhavcopyParser()
        if re.search(r"^cm\d{2}[a-zA-Z]{3}\d{4}bhav", filename, re.IGNORECASE):
            return LegacyBhavcopyParser()
        if filename.lower().startswith("sec_bhavdata"):
            return LegacyBhavcopyParser()

        # Peek inside file headers to detect format
        detected_format = cls._detect_format_from_content(path)
        if detected_format == SourceFormat.UDIFF_BHAVCOPY:
            return UdiffBhavcopyParser()
        elif detected_format == SourceFormat.LEGACY_BHAVCOPY:
            return LegacyBhavcopyParser()

        raise UnsupportedFormatError(
            f"Could not automatically detect archive format for file: {filename}"
        )

    @classmethod
    def _detect_format_from_content(cls, path: Path) -> SourceFormat | None:
        """Peeks at file header columns."""
        header_line = ""
        try:
            if path.name.lower().endswith(".zip") and zipfile.is_zipfile(path):
                with zipfile.ZipFile(path, "r") as zf:
                    csv_names = [n for n in zf.namelist() if n.lower().endswith(".csv")]
                    if csv_names:
                        with zf.open(csv_names[0]) as f:
                            header_line = f.readline().decode("utf-8", errors="ignore")
            else:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    header_line = f.readline()
        except Exception:
            return None

        header_upper = header_line.upper()
        if "TCKRSYMB" in header_upper or "OPNPRIC" in header_upper:
            return SourceFormat.UDIFF_BHAVCOPY
        if "SYMBOL" in header_upper or "TOTTRDQTY" in header_upper:
            return SourceFormat.LEGACY_BHAVCOPY

        return None

    @classmethod
    def get_parser_for_bytes(
        cls,
        data: bytes,
        filename: str,
        format_hint: SourceFormat | None = None,
    ) -> BaseParser:
        """Determines and returns the appropriate parser for in-memory bytes."""
        if format_hint == SourceFormat.LEGACY_BHAVCOPY:
            return LegacyBhavcopyParser()
        if format_hint == SourceFormat.UDIFF_BHAVCOPY:
            return UdiffBhavcopyParser()

        # Filename regex matching
        if re.search(r"^BhavCopy_NSE_CM", filename, re.IGNORECASE):
            return UdiffBhavcopyParser()
        if re.search(r"^cm\d{2}[a-zA-Z]{3}\d{4}bhav", filename, re.IGNORECASE):
            return LegacyBhavcopyParser()
        if filename.lower().startswith("sec_bhavdata"):
            return LegacyBhavcopyParser()

        # Peek inside bytes header
        import io
        header_line = ""
        try:
            bio = io.BytesIO(data)
            if filename.lower().endswith(".zip") and zipfile.is_zipfile(bio):
                with zipfile.ZipFile(bio, "r") as zf:
                    csv_names = [n for n in zf.namelist() if n.lower().endswith(".csv")]
                    if csv_names:
                        with zf.open(csv_names[0]) as f:
                            header_line = f.readline().decode("utf-8", errors="ignore")
            else:
                header_line = data[:1024].decode("utf-8", errors="ignore").splitlines()[0]
        except Exception:
            pass

        header_upper = header_line.upper()
        if "TCKRSYMB" in header_upper or "OPNPRIC" in header_upper:
            return UdiffBhavcopyParser()
        if "SYMBOL" in header_upper or "TOTTRDQTY" in header_upper:
            return LegacyBhavcopyParser()

        # Default fallback: if post-July 8 2024, UDiFF; otherwise Legacy
        return UdiffBhavcopyParser()
