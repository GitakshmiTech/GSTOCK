"""Notifier re-exports."""

from nse_pipeline.notifications.alert_manager import AlertManager
from nse_pipeline.notifications.email_notifier import EmailNotifier

Notifier = AlertManager
__all__ = ["AlertManager", "EmailNotifier", "Notifier"]
