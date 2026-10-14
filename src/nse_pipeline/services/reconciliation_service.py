"""Reconciliation service alias."""

from nse_pipeline.services.recovery_service import RecoveryService

ReconciliationService = RecoveryService
__all__ = ["ReconciliationService", "RecoveryService"]
