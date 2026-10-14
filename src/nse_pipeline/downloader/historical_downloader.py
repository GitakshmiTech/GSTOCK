"""Historical and daily downloader conveniences."""

from nse_pipeline.downloader.download_manager import DownloadManager, DownloadResult
from nse_pipeline.downloader.file_registry import FileRegistry

HistoricalDownloader = DownloadManager
DailyDownloader = DownloadManager
FileManager = FileRegistry

__all__ = ["DailyDownloader", "DownloadManager", "DownloadResult", "FileManager", "HistoricalDownloader"]
