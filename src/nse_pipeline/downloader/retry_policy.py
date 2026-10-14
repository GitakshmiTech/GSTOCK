"""Retry policies and strategies using Tenacity."""

from collections.abc import Callable

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    stop_after_delay,
    wait_exponential,
)

from nse_pipeline.core.exceptions import DownloaderError


def create_download_retry_decorator(
    max_retries: int = 5,
    initial_wait_seconds: float = 2.0,
    max_wait_seconds: float = 60.0,
) -> Callable:
    """Returns a retry decorator suitable for network transient errors."""
    return retry(
        retry=retry_if_exception_type(DownloaderError),
        stop=stop_after_attempt(max_retries),
        wait=wait_exponential(multiplier=1, min=initial_wait_seconds, max=max_wait_seconds),
        reraise=True,
    )


def create_eod_waiting_retry_decorator(
    max_wait_minutes: int = 60,
    initial_interval_seconds: int = 60,
    max_interval_seconds: int = 600,
) -> Callable:
    """Returns a retry decorator designed for polling delayed official EOD publication."""
    return retry(
        stop=stop_after_delay(max_wait_minutes * 60),
        wait=wait_exponential(multiplier=1, min=initial_interval_seconds, max=max_interval_seconds),
        reraise=True,
    )
