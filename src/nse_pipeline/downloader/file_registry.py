"""Local file management and directory path resolution."""

import shutil
from datetime import date
from pathlib import Path

from nse_pipeline.core.config import get_settings
from nse_pipeline.core.logging import get_logger
from nse_pipeline.downloader.checksum import calculate_sha256

logger = get_logger("downloader.file_registry")


class FileRegistry:
    def __init__(self):
        self.settings = get_settings()

    def get_raw_storage_path(self, trade_date: date, filename: str) -> Path:
        """Returns structured storage path in data/raw/YYYY/MM/<filename>."""
        year = str(trade_date.year)
        month = f"{trade_date.month:02d}"
        dest_dir = Path(self.settings.raw_data_dir) / year / month
        dest_dir.mkdir(parents=True, exist_ok=True)
        return dest_dir / filename

    def file_exists_locally(self, trade_date: date, filename: str) -> Path | None:
        """Checks if a matching file already exists locally."""
        dest = self.get_raw_storage_path(trade_date, filename)
        if dest.exists() and dest.stat().st_size > 0:
            return dest
        return None

    def quarantine_file(self, file_path: str | Path, reason: str) -> Path:
        """Moves corrupted or invalid file to quarantine folder with reason recorded."""
        source = Path(file_path)
        quarantine_dir = Path(self.settings.quarantine_dir)
        quarantine_dir.mkdir(parents=True, exist_ok=True)

        target = quarantine_dir / f"{source.name}.quarantined"
        shutil.move(str(source), str(target))

        # Write quarantine note
        note_file = quarantine_dir / f"{source.name}.reason.txt"
        note_file.write_text(reason, encoding="utf-8")

        logger.warning(f"Quarantined {source.name} to {target}: {reason}")
        return target

    def inspect_file(self, file_path: str | Path) -> tuple[int, str]:
        """Returns file size in bytes and SHA-256 checksum."""
        p = Path(file_path)
        size = p.stat().st_size
        checksum = calculate_sha256(p)
        return size, checksum
