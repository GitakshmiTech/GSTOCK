"""Client dedicated to historical batch operations."""

from nse_pipeline.clients.public_archive_client import PublicArchiveClient
from nse_pipeline.core.logging import get_logger

logger = get_logger("clients.historical_client")


class HistoricalClient(PublicArchiveClient):
    """Client for historical backfills across 2001 - 2026."""

    def __init__(self, timeout: float = 60.0, max_retries: int = 5):
        super().__init__(timeout=timeout, max_retries=max_retries)
