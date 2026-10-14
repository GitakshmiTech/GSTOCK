import hashlib
import uuid
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from nse_pipeline.core.constants import FileStatus, SourceFormat
from nse_pipeline.core.logging import get_logger
from nse_pipeline.database.models import StockDailyHistory
from nse_pipeline.database.repositories.ingestion_repository import IngestionRepository
from nse_pipeline.database.repositories.price_repository import PriceRepository
from nse_pipeline.database.repositories.security_repository import SecurityRepository
from nse_pipeline.downloader.download_manager import DownloadBytesResult, DownloadResult
from nse_pipeline.downloader.file_registry import FileRegistry
from nse_pipeline.normalization.normalizer import Normalizer
from nse_pipeline.parsers.parser_factory import ParserFactory
from nse_pipeline.validation.quality_report import QualityReportEngine, ValidationReport

logger = get_logger("services.ingestion")


@dataclass
class IngestionResult:
    trade_date: date
    file_name: str
    status: FileStatus
    raw_row_count: int = 0
    parsed_count: int = 0
    inserted_count: int = 0
    updated_count: int = 0
    skipped_count: int = 0
    rejected_count: int = 0
    source_url: str | None = None
    source_format: str | None = None
    validation_report: ValidationReport | None = None
    error_message: str | None = None


class IngestionService:
    def __init__(self, session: Session):
        self.session = session
        self.ingestion_repo = IngestionRepository(session)
        self.security_repo = SecurityRepository(session)
        self.price_repo = PriceRepository(session)
        self.file_registry = FileRegistry()

    def ingest_bytes(
        self,
        data: bytes,
        file_name: str,
        trade_date_override: date | None = None,
        source_format_hint: SourceFormat | None = None,
        source_url: str = "IN_MEMORY_STREAM",
        job_id: str | None = None,
    ) -> IngestionResult:
        """Ingests archive data directly from in-memory bytes without intermediate files."""
        checksum = hashlib.sha256(data).hexdigest()
        file_size = len(data)
        job_id = job_id or f"job_{uuid.uuid4().hex[:12]}"

        logger.info(f"Starting in-memory ingestion of {file_name} ({file_size:,} bytes, Job: {job_id})")
        self.ingestion_repo.log_stage(job_id, "PARSE", "STARTED", trade_date=trade_date_override)

        # 1. Parse using in-memory factory
        try:
            parser = ParserFactory.get_parser_for_bytes(data, filename=file_name, format_hint=source_format_hint)
            raw_df = parser.parse_bytes(data, file_name=file_name)
        except Exception as e:
            err = f"In-memory parsing failed for {file_name}: {e}"
            logger.error(err)
            self.ingestion_repo.log_stage(job_id, "PARSE", "FAILED", trade_date=trade_date_override, error_message=err)
            return IngestionResult(
                trade_date=trade_date_override or date.today(),
                file_name=file_name,
                status=FileStatus.FAILED,
                source_url=source_url,
                error_message=err,
            )

        raw_count = len(raw_df)
        logger.info(f"Parsed {raw_count} raw rows in-memory from {file_name}")

        # 2. Normalize records
        normalized_records = Normalizer.normalize_records(raw_df, fallback_date=trade_date_override)
        if not normalized_records:
            err = f"Zero valid records normalized from {file_name}"
            logger.warning(err)
            return IngestionResult(
                trade_date=trade_date_override or date.today(),
                file_name=file_name,
                status=FileStatus.FAILED,
                raw_row_count=raw_count,
                source_url=source_url,
                error_message=err,
            )

        inferred_trade_date = normalized_records[0]["trade_date"]
        self.ingestion_repo.log_stage(job_id, "VALIDATE", "STARTED", trade_date=inferred_trade_date)

        # 3. Quality checks and validation
        valid_records, val_report = QualityReportEngine.validate_batch(normalized_records, inferred_trade_date)
        logger.info(
            f"Validation complete for {inferred_trade_date}: {len(valid_records)} valid, "
            f"{val_report.rejected_records} rejected, {val_report.warning_count} warnings, {val_report.error_count} errors"
        )

        for issue in val_report.issues:
            self.ingestion_repo.record_quality_issue(
                trade_date=inferred_trade_date,
                symbol=issue.get("symbol"),
                series=issue.get("series"),
                rule_name=issue["rule_name"],
                severity=issue["severity"],
                issue_details=issue["details"],
            )

        if not valid_records:
            err = f"All {len(normalized_records)} records failed validation in {file_name}"
            logger.error(err)
            return IngestionResult(
                trade_date=inferred_trade_date,
                file_name=file_name,
                status=FileStatus.QUARANTINED,
                raw_row_count=raw_count,
                rejected_count=len(normalized_records),
                source_url=source_url,
                validation_report=val_report,
                error_message=err,
            )

        # 4. Resolve Security IDs in Security Master
        self.ingestion_repo.log_stage(job_id, "SECURITY_RESOLVE", "STARTED", trade_date=inferred_trade_date)
        sec_map = self.security_repo.bulk_resolve_security_ids(valid_records, trade_date=inferred_trade_date)

        for rec in valid_records:
            sec_id = sec_map.get((rec["symbol"], rec["series"]))
            rec["security_id"] = sec_id
            rec["source_format"] = parser.format_name
            rec["source_file"] = file_name

        # Calculate pre-existing records to accurately differentiate inserted vs updated count
        existing_keys = set(
            self.session.execute(
                select(StockDailyHistory.symbol, StockDailyHistory.series).where(
                    StockDailyHistory.trade_date == inferred_trade_date
                )
            ).all()
        )
        inserted_count = sum(1 for r in valid_records if (r["symbol"], r["series"]) not in existing_keys)
        updated_count = len(valid_records) - inserted_count

        # 5. Transactional Bulk Upsert into stock_daily_history
        self.ingestion_repo.log_stage(job_id, "UPSERT", "STARTED", trade_date=inferred_trade_date)
        try:
            self.price_repo.bulk_upsert(valid_records)
            self.session.commit()
            logger.info(
                f"Successfully upserted {len(valid_records)} records for {inferred_trade_date} "
                f"({inserted_count} inserted, {updated_count} updated)"
            )
        except Exception as e:
            self.session.rollback()
            err = f"Database bulk upsert transaction failed: {e}"
            logger.error(err)
            self.ingestion_repo.log_stage(job_id, "UPSERT", "FAILED", trade_date=inferred_trade_date, error_message=err)
            return IngestionResult(
                trade_date=inferred_trade_date,
                file_name=file_name,
                status=FileStatus.FAILED,
                raw_row_count=raw_count,
                source_url=source_url,
                error_message=err,
            )

        # 6. Record file audit trail
        file_meta = {
            "job_id": job_id,
            "trade_date": inferred_trade_date,
            "file_name": file_name,
            "file_path": "IN_MEMORY",
            "source_url": source_url,
            "file_size": file_size,
            "checksum_sha256": checksum,
            "source_format": parser.format_name,
            "parser_version": parser.version,
            "status": FileStatus.IMPORTED,
            "row_count": raw_count,
            "parsed_count": len(normalized_records),
            "inserted_count": inserted_count,
            "updated_count": updated_count,
            "skipped_count": 0,
            "rejected_count": val_report.rejected_records,
        }
        self.ingestion_repo.record_file(file_meta)
        self.ingestion_repo.log_stage(job_id, "INGESTION", "COMPLETED", trade_date=inferred_trade_date)
        self.session.commit()

        return IngestionResult(
            trade_date=inferred_trade_date,
            file_name=file_name,
            status=FileStatus.IMPORTED,
            raw_row_count=raw_count,
            parsed_count=len(normalized_records),
            inserted_count=inserted_count,
            updated_count=updated_count,
            rejected_count=val_report.rejected_records,
            source_url=source_url,
            source_format=parser.format_name,
            validation_report=val_report,
        )

    def ingest_file(
        self,
        file_path: str | Path,
        job_id: str | None = None,
        trade_date_override: date | None = None,
        source_format_hint: SourceFormat | None = None,
    ) -> IngestionResult:
        """Ingests a single local file (ZIP, GZIP or CSV)."""
        path = Path(file_path)
        if not path.is_file():
            raise FileNotFoundError(f"File not found: {file_path}")

        job_id = job_id or f"job_{uuid.uuid4().hex[:12]}"
        file_size, checksum = self.file_registry.inspect_file(path)

        logger.info(f"Starting ingestion of {path.name} (Job: {job_id})")
        self.ingestion_repo.log_stage(job_id, "PARSE", "STARTED", trade_date=trade_date_override)

        # 1. Parse using factory
        try:
            parser = ParserFactory.get_parser(path, format_hint=source_format_hint)
            raw_df = parser.parse(path)
        except Exception as e:
            err = f"Parsing failed for {path.name}: {e}"
            logger.error(err)
            self.file_registry.quarantine_file(path, reason=err)
            self.ingestion_repo.log_stage(job_id, "PARSE", "FAILED", trade_date=trade_date_override, error_message=err)
            return IngestionResult(
                trade_date=trade_date_override or date.today(),
                file_name=path.name,
                status=FileStatus.FAILED,
                error_message=err,
            )

        raw_count = len(raw_df)
        logger.info(f"Parsed {raw_count} raw rows from {path.name}")

        # 2. Normalize records
        normalized_records = Normalizer.normalize_records(raw_df, fallback_date=trade_date_override)
        if not normalized_records:
            err = f"Zero valid records normalized from {path.name}"
            logger.warning(err)
            return IngestionResult(
                trade_date=trade_date_override or date.today(),
                file_name=path.name,
                status=FileStatus.FAILED,
                raw_row_count=raw_count,
                error_message=err,
            )

        inferred_trade_date = normalized_records[0]["trade_date"]
        self.ingestion_repo.log_stage(job_id, "VALIDATE", "STARTED", trade_date=inferred_trade_date)

        # 3. Quality checks and validation
        valid_records, val_report = QualityReportEngine.validate_batch(normalized_records, inferred_trade_date)
        logger.info(
            f"Validation complete for {inferred_trade_date}: {len(valid_records)} valid, "
            f"{val_report.rejected_records} rejected, {val_report.warning_count} warnings, {val_report.error_count} errors"
        )

        for issue in val_report.issues:
            self.ingestion_repo.record_quality_issue(
                trade_date=inferred_trade_date,
                symbol=issue.get("symbol"),
                series=issue.get("series"),
                rule_name=issue["rule_name"],
                severity=issue["severity"],
                issue_details=issue["details"],
            )

        if not valid_records:
            err = f"All {len(normalized_records)} records failed validation in {path.name}"
            logger.error(err)
            self.file_registry.quarantine_file(path, reason=err)
            return IngestionResult(
                trade_date=inferred_trade_date,
                file_name=path.name,
                status=FileStatus.QUARANTINED,
                raw_row_count=raw_count,
                rejected_count=len(normalized_records),
                validation_report=val_report,
                error_message=err,
            )

        # 4. Resolve Security IDs in Security Master
        self.ingestion_repo.log_stage(job_id, "SECURITY_RESOLVE", "STARTED", trade_date=inferred_trade_date)
        sec_map = self.security_repo.bulk_resolve_security_ids(valid_records, trade_date=inferred_trade_date)

        for rec in valid_records:
            sec_id = sec_map.get((rec["symbol"], rec["series"]))
            rec["security_id"] = sec_id
            rec["source_format"] = parser.format_name
            rec["source_file"] = path.name

        # Calculate pre-existing records to accurately differentiate inserted vs updated count
        existing_keys = set(
            self.session.execute(
                select(StockDailyHistory.symbol, StockDailyHistory.series).where(
                    StockDailyHistory.trade_date == inferred_trade_date
                )
            ).all()
        )
        inserted_count = sum(1 for r in valid_records if (r["symbol"], r["series"]) not in existing_keys)
        updated_count = len(valid_records) - inserted_count

        # 5. Transactional Bulk Upsert into stock_daily_history
        self.ingestion_repo.log_stage(job_id, "UPSERT", "STARTED", trade_date=inferred_trade_date)
        try:
            self.price_repo.bulk_upsert(valid_records)
            self.session.commit()
            logger.info(
                f"Successfully upserted {len(valid_records)} records for {inferred_trade_date} "
                f"({inserted_count} inserted, {updated_count} updated)"
            )
        except Exception as e:
            self.session.rollback()
            err = f"Database bulk upsert transaction failed: {e}"
            logger.error(err)
            self.ingestion_repo.log_stage(job_id, "UPSERT", "FAILED", trade_date=inferred_trade_date, error_message=err)
            return IngestionResult(
                trade_date=inferred_trade_date,
                file_name=path.name,
                status=FileStatus.FAILED,
                raw_row_count=raw_count,
                error_message=err,
            )

        # 6. Record file audit trail
        file_meta = {
            "job_id": job_id,
            "trade_date": inferred_trade_date,
            "file_name": path.name,
            "file_path": str(path),
            "source_url": "LOCAL" if not path.name.startswith("http") else str(path),
            "file_size": file_size,
            "checksum_sha256": checksum,
            "source_format": parser.format_name,
            "parser_version": parser.version,
            "status": FileStatus.IMPORTED,
            "row_count": raw_count,
            "parsed_count": len(normalized_records),
            "inserted_count": inserted_count,
            "updated_count": updated_count,
            "skipped_count": 0,
            "rejected_count": val_report.rejected_records,
        }
        self.ingestion_repo.record_file(file_meta)
        self.ingestion_repo.log_stage(job_id, "INGESTION", "COMPLETED", trade_date=inferred_trade_date)
        self.session.commit()

        return IngestionResult(
            trade_date=inferred_trade_date,
            file_name=path.name,
            status=FileStatus.IMPORTED,
            raw_row_count=raw_count,
            parsed_count=len(normalized_records),
            inserted_count=inserted_count,
            updated_count=updated_count,
            rejected_count=val_report.rejected_records,
            source_url="LOCAL",
            source_format=parser.format_name,
            validation_report=val_report,
        )

    def ingest_download_result(self, dl: DownloadResult, job_id: str) -> IngestionResult:
        """Processes a DownloadResult produced by DownloadManager."""
        return self.ingest_file(
            file_path=dl.file_path,
            job_id=job_id,
            trade_date_override=dl.trade_date,
            source_format_hint=dl.source_format,
        )

    def ingest_download_bytes_result(self, dl: DownloadBytesResult, job_id: str) -> IngestionResult:
        """Processes an in-memory DownloadBytesResult produced by DownloadManager."""
        return self.ingest_bytes(
            data=dl.data,
            file_name=dl.file_name,
            trade_date_override=dl.trade_date,
            source_format_hint=dl.source_format,
            source_url=dl.source_url,
            job_id=job_id,
        )

