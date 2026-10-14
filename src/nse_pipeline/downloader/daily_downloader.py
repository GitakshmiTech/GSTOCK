"""Daily downloader convenience re-export."""

from nse_pipeline.downloader.download_manager import DownloadManager

DailyDownloader = DownloadManager
__all__ = ["DailyDownloader", "DownloadManager"]
