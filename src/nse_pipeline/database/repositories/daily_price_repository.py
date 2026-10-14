"""Alias for PriceRepository to ensure compatibility."""

from nse_pipeline.database.repositories.price_repository import PriceRepository

DailyPriceRepository = PriceRepository
__all__ = ["DailyPriceRepository", "PriceRepository"]
