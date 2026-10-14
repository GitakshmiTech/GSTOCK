"""Authorized Paid NSE Data Feed Connector interface."""

from nse_pipeline.clients.base_client import BaseClient
from nse_pipeline.core.exceptions import ConfigurationError
from nse_pipeline.core.logging import get_logger

logger = get_logger("clients.paid_feed_client")


class PaidFeedClient(BaseClient):
    """Client connector for authorized paid NSE direct data delivery service.

    Supports SFTP, S3, or authenticated API feeds depending on commercial subscription.
    """

    def __init__(
        self,
        api_key: str | None = None,
        secret: str | None = None,
        feed_endpoint: str | None = None,
        timeout: float = 60.0,
    ):
        super().__init__(timeout=timeout)
        self.api_key = api_key
        self.secret = secret
        self.feed_endpoint = feed_endpoint
        self._authenticated = False

    def authenticate(self) -> bool:
        """Authenticate with the paid feed provider."""
        if not self.api_key or not self.feed_endpoint:
            raise ConfigurationError("Paid feed credentials (api_key, feed_endpoint) must be supplied.")
        logger.info(f"Authenticating with authorized NSE paid feed endpoint at {self.feed_endpoint}...")
        self._authenticated = True
        return True

    def download_file(self, url: str, destination_path: str) -> str:
        """Retrieve authorized paid EOD package."""
        if not self._authenticated:
            self.authenticate()
        logger.info(f"Fetching authenticated stream from {url}...")
        # Placeholder for subscription delivery protocol
        raise NotImplementedError("Paid feed subscription delivery protocol requires active credentials.")
