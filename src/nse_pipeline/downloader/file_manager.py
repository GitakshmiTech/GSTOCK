"""File manager convenience re-export."""

from nse_pipeline.downloader.file_registry import FileRegistry

FileManager = FileRegistry
__all__ = ["FileManager", "FileRegistry"]
