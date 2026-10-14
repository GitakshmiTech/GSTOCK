"""NSE client re-exports."""

from nse_pipeline.clients.historical_client import HistoricalClient
from nse_pipeline.clients.paid_feed_client import PaidFeedClient
from nse_pipeline.clients.public_archive_client import PublicArchiveClient

NSEClient = PublicArchiveClient

__all__ = ["HistoricalClient", "NSEClient", "PaidFeedClient", "PublicArchiveClient"]
