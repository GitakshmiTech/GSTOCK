"""Incremental daily update service alias."""

from nse_pipeline.services.daily_update_service import DailyUpdateService

IncrementalUpdateService = DailyUpdateService
__all__ = ["IncrementalUpdateService", "DailyUpdateService"]
