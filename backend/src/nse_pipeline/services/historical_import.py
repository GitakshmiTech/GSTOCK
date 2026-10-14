"""Historical import service alias."""

from nse_pipeline.services.backfill_service import BackfillService, BackfillSummary

HistoricalImportService = BackfillService
__all__ = ["HistoricalImportService", "BackfillService", "BackfillSummary"]
