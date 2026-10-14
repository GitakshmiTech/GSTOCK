"""Historical backfill service alias."""

from nse_pipeline.services.backfill_service import BackfillService, BackfillSummary

HistoricalBackfillService = BackfillService
__all__ = ["BackfillService", "BackfillSummary", "HistoricalBackfillService"]
