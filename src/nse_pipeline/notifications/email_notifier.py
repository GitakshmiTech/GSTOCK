"""Email notification provider."""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from nse_pipeline.core.config import get_settings
from nse_pipeline.core.logging import get_logger

logger = get_logger("notifications.email")


class EmailNotifier:
    def __init__(self):
        self.settings = get_settings()

    def send_alert(self, subject: str, message: str) -> bool:
        """Sends an email alert to configured recipients."""
        if not self.settings.alert_email_enabled:
            logger.info(f"[Email Alert Disabled] {subject}: {message}")
            return False

        if not self.settings.smtp_host or not self.settings.smtp_user:
            logger.warning("SMTP host or user not configured, skipping email notification.")
            return False

        try:
            msg = MIMEMultipart()
            msg["From"] = self.settings.smtp_user
            msg["To"] = ", ".join(self.settings.recipient_list)
            msg["Subject"] = f"[NSE Pipeline Alert] {subject}"

            msg.attach(MIMEText(message, "plain"))

            with smtplib.SMTP(self.settings.smtp_host, self.settings.smtp_port) as server:
                server.starttls()
                if self.settings.smtp_password:
                    server.login(self.settings.smtp_user, self.settings.smtp_password)
                server.send_message(msg)

            logger.info(f"Alert email sent to {self.settings.recipient_list}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")
            return False
