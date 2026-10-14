"""Alert manager handling alerts and notifications."""

from nse_pipeline.core.logging import get_logger
from nse_pipeline.notifications.email_notifier import EmailNotifier

logger = get_logger("notifications.alert_manager")


class AlertManager:
    def __init__(self):
        self.email_notifier = EmailNotifier()

    def send_failure_alert(self, job_id: str, job_type: str, error_message: str) -> None:
        subject = f"Job Failed: {job_type} ({job_id})"
        msg = f"The {job_type} job (ID: {job_id}) encountered a fatal failure:\n\n{error_message}\n\nPlease check ingestion logs."
        logger.error(f"ALERT: {subject} - {error_message}")
        self.email_notifier.send_alert(subject, msg)

    def send_quality_warning_alert(self, trade_date: str, warning_count: int, error_count: int) -> None:
        subject = f"Data Quality Threshold Warning for {trade_date}"
        msg = f"During ingestion for {trade_date}, {error_count} errors and {warning_count} warnings were flagged."
        logger.warning(f"ALERT: {subject} - {msg}")
        self.email_notifier.send_alert(subject, msg)
