"""HTTP Client for downloading public NSE archive files."""

from pathlib import Path

import httpx

from nse_pipeline.clients.base_client import BaseClient
from nse_pipeline.core.constants import DEFAULT_USER_AGENT, NSE_HOME_URL
from nse_pipeline.core.exceptions import ArchiveNotFoundError, DownloaderError
from nse_pipeline.core.logging import get_logger

logger = get_logger("clients.public_archive_client")


class PublicArchiveClient(BaseClient):
    def __init__(self, timeout: float = 60.0, max_retries: int = 5):
        super().__init__(timeout=timeout)
        self.max_retries = max_retries
        self._session: httpx.Client | None = None

    def _get_session(self) -> httpx.Client:
        if self._session is None or self._session.is_closed:
            self._session = httpx.Client(
                headers={
                    "User-Agent": DEFAULT_USER_AGENT,
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Referer": NSE_HOME_URL,
                },
                timeout=self.timeout,
                follow_redirects=True,
            )
            try:
                # Warm up session with cookies from official reports page
                self._session.get("https://www.nseindia.com/all-reports", timeout=10.0)
            except Exception as e:
                logger.debug(f"Session warmup request to NSE all-reports returned: {e}")
                try:
                    self._session.get(NSE_HOME_URL, timeout=10.0)
                except Exception:
                    pass
        return self._session

    def download_bytes(self, url: str) -> bytes:
        """Downloads archive content directly into memory without intermediate files."""
        session = self._get_session()
        logger.info(f"Downloading from {url} directly into memory...")

        try:
            response = session.get(url)
            if response.status_code == 404:
                raise ArchiveNotFoundError(f"File not found at {url} (HTTP 404)")
            if response.status_code != 200:
                raise DownloaderError(
                    f"Failed to download {url}: HTTP {response.status_code} - {response.reason_phrase}"
                )
            logger.info(f"Successfully downloaded {len(response.content):,} bytes in-memory from {url}")
            return response.content
        except ArchiveNotFoundError:
            raise
        except httpx.RequestError as e:
            logger.warning(f"Network request error for {url}: {e}")
            raise DownloaderError(f"Network error while downloading {url}: {e}") from e

    def download_file(self, url: str, destination_path: str) -> str:
        """Downloads an archive from the specified URL to local destination path."""
        dest = Path(destination_path)
        dest.parent.mkdir(parents=True, exist_ok=True)

        session = self._get_session()
        logger.info(f"Downloading from {url} to {dest}...")

        try:
            with session.stream("GET", url) as response:
                if response.status_code == 404:
                    raise ArchiveNotFoundError(f"File not found at {url} (HTTP 404)")
                if response.status_code != 200:
                    raise DownloaderError(
                        f"Failed to download {url}: HTTP {response.status_code} - {response.reason_phrase}"
                    )

                with open(dest, "wb") as f:
                    f.writelines(response.iter_bytes(chunk_size=65536))

            logger.info(f"Successfully downloaded {dest.name} ({dest.stat().st_size} bytes)")
            return str(dest)

        except ArchiveNotFoundError:
            raise
        except httpx.RequestError as e:
            logger.warning(f"Network request error for {url}: {e}")
            raise DownloaderError(f"Network error while downloading {url}: {e}") from e

    def close(self) -> None:
        if self._session and not self._session.is_closed:
            self._session.close()
