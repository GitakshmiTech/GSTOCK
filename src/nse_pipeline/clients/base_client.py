"""Base HTTP client with robust headers, session handling and connection resilience."""

from abc import ABC, abstractmethod

from nse_pipeline.core.constants import DEFAULT_USER_AGENT
from nse_pipeline.core.logging import get_logger

logger = get_logger("clients.base_client")


class BaseClient(ABC):
    def __init__(self, timeout: float = 60.0):
        self.timeout = timeout
        self.headers = {
            "User-Agent": DEFAULT_USER_AGENT,
            "Accept": "*/*",
            "Accept-Language": "en-US,en;q=0.9",
            "Connection": "keep-alive",
        }

    @abstractmethod
    def download_file(self, url: str, destination_path: str) -> str:
        """Download remote content to destination path."""
