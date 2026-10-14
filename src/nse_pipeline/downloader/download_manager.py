"""Download manager coordinating remote retrieval, local caching, and checksums."""

import hashlib
from dataclasses import dataclass
from datetime import date

from nse_pipeline.clients.public_archive_client import PublicArchiveClient
from nse_pipeline.core.constants import SourceFormat
from nse_pipeline.core.exceptions import ArchiveNotFoundError, DownloaderError
from nse_pipeline.core.logging import get_logger
from nse_pipeline.downloader.archive_resolver import ArchiveResolver
from nse_pipeline.downloader.file_registry import FileRegistry
from nse_pipeline.downloader.retry_policy import create_download_retry_decorator

logger = get_logger("downloader.download_manager")


@dataclass
class DownloadResult:
    trade_date: date
    file_name: str
    file_path: str
    file_size: int
    checksum_sha256: str
    source_url: str
    source_format: SourceFormat
    is_cached: bool = False


@dataclass
class DownloadBytesResult:
    trade_date: date
    file_name: str
    data: bytes
    file_size: int
    checksum_sha256: str
    source_url: str
    source_format: SourceFormat


class DownloadManager:
    def __init__(self, client: PublicArchiveClient | None = None):
        self.client = client or PublicArchiveClient()
        self.registry = FileRegistry()
        self.retry_download = create_download_retry_decorator()

    def download_bytes_for_date(
        self,
        trade_date: date,
    ) -> DownloadBytesResult | None:
        """Downloads official NSE archive directly in memory without writing to disk.

        Returns None if file is not found (e.g. non-trading day or not yet published).
        """
        source_format = ArchiveResolver.get_source_format_for_date(trade_date)
        expected_filename = ArchiveResolver.resolve_filename(trade_date)
        urls = ArchiveResolver.resolve_urls(trade_date)

        for url in urls:
            try:
                logger.info(f"Attempting in-memory download for {trade_date}: {url}")
                content = self.client.download_bytes(url)
                if content:
                    checksum = hashlib.sha256(content).hexdigest()
                    logger.info(
                        f"Retrieved {len(content):,} bytes in-memory for {trade_date} ({expected_filename}) from {url}"
                    )
                    return DownloadBytesResult(
                        trade_date=trade_date,
                        file_name=expected_filename,
                        data=content,
                        file_size=len(content),
                        checksum_sha256=checksum,
                        source_url=url,
                        source_format=source_format,
                    )
            except ArchiveNotFoundError:
                logger.debug(f"URL not found (404): {url}")
                continue
            except DownloaderError as e:
                logger.warning(f"In-memory download attempt failed for {url}: {e}")
                continue

        logger.warning(f"No archive available in-memory for trade date {trade_date}")
        return None

    def download_for_date(
        self,
        trade_date: date,
        force_redownload: bool = False,
    ) -> DownloadResult | None:
        """Downloads official NSE archive for the specified trading date.

        Returns None if file is not found (e.g. non-trading day or not yet published).
        """
        source_format = ArchiveResolver.get_source_format_for_date(trade_date)
        expected_filename = ArchiveResolver.resolve_filename(trade_date)

        # 1. Check local cache
        if not force_redownload:
            existing = self.registry.file_exists_locally(trade_date, expected_filename)
            if existing:
                size, checksum = self.registry.inspect_file(existing)
                logger.info(f"File for {trade_date} already exists locally: {existing.name}")
                return DownloadResult(
                    trade_date=trade_date,
                    file_name=expected_filename,
                    file_path=str(existing),
                    file_size=size,
                    checksum_sha256=checksum,
                    source_url="LOCAL_CACHE",
                    source_format=source_format,
                    is_cached=True,
                )

        # 2. Resolve URLs
        urls = ArchiveResolver.resolve_urls(trade_date)
        target_path = self.registry.get_raw_storage_path(trade_date, expected_filename)

        downloaded_url = None
        for url in urls:
            try:
                logger.info(f"Trying URL for {trade_date}: {url}")
                # Execute download with retry logic
                self.client.download_file(url, str(target_path))
                downloaded_url = url
                break
            except ArchiveNotFoundError:
                logger.debug(f"URL not found (404): {url}")
                continue
            except DownloaderError as e:
                logger.warning(f"Download attempt failed for {url}: {e}")
                continue

        if not downloaded_url or not target_path.exists():
            logger.warning(f"No archive available for trade date {trade_date}")
            return None

        # 3. Calculate checksum
        size, checksum = self.registry.inspect_file(target_path)

        return DownloadResult(
            trade_date=trade_date,
            file_name=expected_filename,
            file_path=str(target_path),
            file_size=size,
            checksum_sha256=checksum,
            source_url=downloaded_url,
            source_format=source_format,
            is_cached=False,
        )

