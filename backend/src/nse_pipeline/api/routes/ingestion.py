from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from nse_pipeline.api.dependencies import get_db
from nse_pipeline.api.schemas.ingestion import (
    BackfillRequest,
    BhavcopyImportRequest,
    BhavcopyImportResponse,
    IngestionFileSchema,
    IngestionJobSchema,
    LatestAvailableDateResponse,
    QualityIssueSchema,
)
from nse_pipeline.core.clock import parse_date
from nse_pipeline.database.models import StockDailyHistory
from nse_pipeline.database.repositories.ingestion_repository import IngestionRepository
from nse_pipeline.downloader.archive_resolver import ArchiveResolver
from nse_pipeline.scheduler.trading_calendar import NSETradingCalendar
from nse_pipeline.services.backfill_service import BackfillService
from nse_pipeline.services.bhavcopy_service import BhavcopyService, get_latest_market_trading_date

router = APIRouter(tags=["Ingestion & Quality"])


@router.get("/api/v1/ingestion/latest-available-date", response_model=LatestAvailableDateResponse)
def get_latest_available_date(db: Session = Depends(get_db)):
    """Determines the most recent eligible NSE trading date and expected Bhavcopy filename."""
    latest_trade_d = get_latest_market_trading_date(session=db)
    is_trading = NSETradingCalendar.is_trading_day(latest_trade_d, session=db)
    source_format = ArchiveResolver.get_source_format_for_date(latest_trade_d)
    expected_filename = ArchiveResolver.resolve_filename(latest_trade_d)

    # Latest date in DB
    latest_db_d = db.execute(select(func.max(StockDailyHistory.trade_date))).scalar()

    return {
        "latest_trade_date": str(latest_trade_d),
        "is_trading_day": is_trading,
        "source_format": source_format.value,
        "expected_filename": expected_filename,
        "latest_db_date": str(latest_db_d) if latest_db_d else None,
    }


@router.post("/api/v1/ingestion/download-and-import", response_model=BhavcopyImportResponse)
def download_and_import_bhavcopy(
    request: BhavcopyImportRequest,
    db: Session = Depends(get_db),
):
    """Downloads official NSE Bhavcopy directly in memory, validates it, and idempotently upserts to DB."""
    target_d = parse_date(request.trade_date) if request.trade_date else None
    svc = BhavcopyService(session=db)
    result = svc.download_and_import(target_date=target_d, force=request.force)
    return result


@router.get("/api/v1/ingestion/files", response_model=list[IngestionFileSchema])
def list_ingestion_files(
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
):
    """Retrieve detailed per-file audit history with row-level metrics."""
    repo = IngestionRepository(db)
    return repo.list_files(limit=limit)


@router.get("/api/v1/ingestion/jobs", response_model=list[IngestionJobSchema])
def list_ingestion_jobs(
    limit: int = Query(default=50, le=200),
    db: Session = Depends(get_db),
):
    """Retrieve history of ingestion and backfill jobs."""
    repo = IngestionRepository(db)
    return repo.list_jobs(limit=limit)


@router.get("/api/v1/ingestion/jobs/{job_id}", response_model=IngestionJobSchema)
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """Retrieve detailed execution status for a specific job."""
    repo = IngestionRepository(db)
    job = repo.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job not found: {job_id}")
    return job


def _run_backfill_task(start_d: date, end_d: date, resume: bool, batch_size: int | None):
    svc = BackfillService()
    svc.run_backfill(start_date=start_d, end_date=end_d, resume=resume, batch_size=batch_size)


@router.post("/api/v1/ingestion/backfill")
def trigger_backfill(
    request: BackfillRequest,
    background_tasks: BackgroundTasks,
):
    """Trigger an asynchronous historical backfill job."""
    start_d = parse_date(request.start_date)
    end_d = parse_date(request.end_date)

    background_tasks.add_task(
        _run_backfill_task,
        start_d,
        end_d,
        request.resume,
        request.batch_size,
    )
    return {
        "status": "accepted",
        "message": f"Historical backfill scheduled from {start_d} to {end_d}.",
    }


def _run_daily_update_task(target_d: date | None, force: bool, wait: bool):
    from nse_pipeline.services.daily_update_service import DailyUpdateService
    svc = DailyUpdateService()
    svc.run_daily_update(target_date=target_d, force=force, wait_for_publication=wait)


@router.post("/api/v1/daily-update")
def trigger_daily_update(
    background_tasks: BackgroundTasks,
    target_date: str | None = Query(default=None, description="Optional target date YYYY-MM-DD"),
    force: bool = Query(default=False),
    wait: bool = Query(default=False),
):
    """Trigger the incremental daily EOD update."""
    target_d = parse_date(target_date) if target_date else None
    background_tasks.add_task(_run_daily_update_task, target_d, force, wait)
    return {
        "status": "accepted",
        "message": f"Daily update triggered for {target_d or 'today'}.",
    }


@router.get("/api/v1/quality/issues", response_model=list[QualityIssueSchema])
def list_quality_issues(
    trade_date: date | None = None,
    severity: str | None = None,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
):
    """Review flagged data quality and validation issues."""
    repo = IngestionRepository(db)
    return repo.list_quality_issues(trade_date=trade_date, severity=severity, limit=limit)


@router.get("/api/v1/scheduler/status")
def get_scheduler_info():
    """Retrieve the operational status of the automated 4:00 PM EOD scheduler."""
    from nse_pipeline.scheduler.daily_scheduler import get_scheduler_status
    return get_scheduler_status()


