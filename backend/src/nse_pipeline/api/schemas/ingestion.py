"""Pydantic schemas for ingestion jobs and quality issues."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class BackfillRequest(BaseModel):
    start_date: str
    end_date: str
    resume: bool = True
    batch_size: int | None = None


class IngestionJobSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    job_id: str
    job_type: str
    start_date: date | None = None
    end_date: date | None = None
    status: str
    total_dates: int
    successful_dates: int
    failed_dates: int
    total_rows_imported: int
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error_message: str | None = None


class QualityIssueSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trade_date: date
    symbol: str | None = None
    series: str | None = None
    rule_name: str
    severity: str
    issue_details: str
    is_resolved: bool
    created_at: datetime


class BhavcopyImportRequest(BaseModel):
    trade_date: str | None = None  # YYYY-MM-DD or None for latest available
    force: bool = False


class BhavcopyImportResponse(BaseModel):
    status: str
    trade_date: str
    file_name: str
    source_url: str | None = None
    source_format: str | None = None
    records_downloaded: int = 0
    records_parsed: int = 0
    records_inserted: int = 0
    records_updated: int = 0
    records_skipped: int = 0
    records_rejected: int = 0
    execution_time_seconds: float = 0.0
    message: str
    error_details: str | None = None


class LatestAvailableDateResponse(BaseModel):
    latest_trade_date: str
    is_trading_day: bool
    source_format: str
    expected_filename: str
    latest_db_date: str | None = None


class IngestionFileSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: str
    trade_date: date
    file_name: str
    file_path: str | None = None
    source_url: str | None = None
    file_size: int | None = None
    source_format: str
    parser_version: str
    status: str
    row_count: int
    parsed_count: int
    inserted_count: int
    updated_count: int
    skipped_count: int
    rejected_count: int
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

