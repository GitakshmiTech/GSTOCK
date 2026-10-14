"""Repository for ingestion jobs, file tracking, audit logs and data quality issues."""

from datetime import date, datetime
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from nse_pipeline.database.models import (
    DataQualityIssue,
    IngestionFile,
    IngestionJob,
    IngestionLog,
)


class IngestionRepository:
    def __init__(self, session: Session):
        self.session = session

    def create_job(
        self,
        job_id: str,
        job_type: str,
        start_date: date | None = None,
        end_date: date | None = None,
        total_dates: int = 0,
    ) -> IngestionJob:
        """Creates a new ingestion job entry."""
        job = IngestionJob(
            job_id=job_id,
            job_type=job_type,
            start_date=start_date,
            end_date=end_date,
            status="RUNNING",
            total_dates=total_dates,
            started_at=datetime.now(),
        )
        self.session.add(job)
        self.session.flush()
        return job

    def get_job(self, job_id: str) -> IngestionJob | None:
        stmt = select(IngestionJob).where(IngestionJob.job_id == job_id)
        return self.session.execute(stmt).scalar_one_or_none()

    def list_jobs(self, limit: int = 50) -> list[IngestionJob]:
        stmt = select(IngestionJob).order_by(desc(IngestionJob.created_at)).limit(limit)
        return list(self.session.execute(stmt).scalars().all())

    def update_job_status(
        self,
        job_id: str,
        status: str,
        successful_dates: int = 0,
        failed_dates: int = 0,
        total_rows: int = 0,
        error_message: str | None = None,
    ) -> None:
        job = self.get_job(job_id)
        if job:
            job.status = status
            job.successful_dates = successful_dates
            job.failed_dates = failed_dates
            job.total_rows_imported = total_rows
            if status in ("SUCCESS", "FAILED", "PARTIAL"):
                job.completed_at = datetime.now()
            if error_message:
                job.error_message = error_message
            self.session.flush()

    def record_file(self, data: dict[str, Any]) -> IngestionFile:
        """Records an ingested file into ingestion_files."""
        trade_date = data["trade_date"]
        checksum = data.get("checksum_sha256")

        # Check existing by trade date and checksum
        existing = None
        if checksum:
            stmt = select(IngestionFile).where(
                IngestionFile.trade_date == trade_date,
                IngestionFile.checksum_sha256 == checksum,
            )
            existing = self.session.execute(stmt).scalar_one_or_none()

        if existing:
            for k, v in data.items():
                if hasattr(existing, k) and v is not None:
                    setattr(existing, k, v)
            self.session.flush()
            return existing

        f = IngestionFile(
            job_id=data["job_id"],
            trade_date=trade_date,
            file_name=data["file_name"],
            file_path=data.get("file_path"),
            source_url=data.get("source_url"),
            file_size=data.get("file_size"),
            checksum_sha256=checksum,
            source_format=data["source_format"],
            parser_version=data.get("parser_version", "1.0.0"),
            status=data.get("status", "PENDING"),
            row_count=data.get("row_count", 0),
            parsed_count=data.get("parsed_count", 0),
            inserted_count=data.get("inserted_count", 0),
            updated_count=data.get("updated_count", 0),
            skipped_count=data.get("skipped_count", 0),
            rejected_count=data.get("rejected_count", 0),
            error_message=data.get("error_message"),
        )
        self.session.add(f)
        self.session.flush()
        return f

    def find_file_by_date(self, trade_date: date) -> IngestionFile | None:
        stmt = (
            select(IngestionFile)
            .where(IngestionFile.trade_date == trade_date)
            .order_by(desc(IngestionFile.created_at))
            .limit(1)
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def list_files(self, limit: int = 50) -> list[IngestionFile]:
        """Returns the most recent ingested files with detailed row metrics."""
        stmt = select(IngestionFile).order_by(desc(IngestionFile.created_at)).limit(limit)
        return list(self.session.execute(stmt).scalars().all())

    def log_stage(
        self,
        job_id: str,
        stage: str,
        status: str,
        trade_date: date | None = None,
        details: dict[str, Any] | None = None,
        error_message: str | None = None,
    ) -> IngestionLog:
        log_entry = IngestionLog(
            job_id=job_id,
            trade_date=trade_date,
            stage=stage,
            status=status,
            details=details,
            error_message=error_message,
        )
        self.session.add(log_entry)
        self.session.flush()
        return log_entry

    def record_quality_issue(
        self,
        trade_date: date,
        rule_name: str,
        severity: str,
        issue_details: str,
        symbol: str | None = None,
        series: str | None = None,
        raw_data: dict[str, Any] | None = None,
    ) -> DataQualityIssue:
        issue = DataQualityIssue(
            trade_date=trade_date,
            symbol=symbol,
            series=series,
            rule_name=rule_name,
            severity=severity,
            issue_details=issue_details,
            raw_data=raw_data,
        )
        self.session.add(issue)
        self.session.flush()
        return issue

    def list_quality_issues(
        self,
        trade_date: date | None = None,
        severity: str | None = None,
        limit: int = 100,
    ) -> list[DataQualityIssue]:
        stmt = select(DataQualityIssue)
        if trade_date:
            stmt = stmt.where(DataQualityIssue.trade_date == trade_date)
        if severity:
            stmt = stmt.where(DataQualityIssue.severity == severity.upper())
        stmt = stmt.order_by(desc(DataQualityIssue.created_at)).limit(limit)
        return list(self.session.execute(stmt).scalars().all())
