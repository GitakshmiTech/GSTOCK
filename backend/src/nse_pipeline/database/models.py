"""SQLAlchemy 2.x Declarative Models for the NSE Market Data Pipeline."""

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON

from nse_pipeline.database.connection import Base

# Dialect-compatible BigInteger ID that autoincrements in both MySQL and SQLite
PK_ID = BigInteger().with_variant(Integer, "sqlite")


class SchemaMigration(Base):
    __tablename__ = "schema_migrations"

    version = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    applied_at = Column(DateTime, server_default=func.now(), nullable=False)


class TradingCalendar(Base):
    __tablename__ = "trading_calendar"

    trade_date = Column(Date, primary_key=True)
    session_type = Column(String(30), nullable=False, default="EQUITY")
    is_trading_day = Column(Boolean, nullable=False, default=True)
    is_holiday = Column(Boolean, nullable=False, default=False)
    holiday_name = Column(String(150), nullable=True)
    is_weekend = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class Security(Base):
    __tablename__ = "securities"

    id = Column(PK_ID, primary_key=True, autoincrement=True)
    symbol = Column(String(100), nullable=False, index=True)
    series = Column(String(20), nullable=False, default="EQ")
    company_name = Column(String(255), nullable=True)
    isin = Column(String(20), nullable=True, index=True)
    status = Column(String(20), nullable=False, default="ACTIVE")
    first_traded_date = Column(Date, nullable=True)
    last_traded_date = Column(Date, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("symbol", "series", name="uq_symbol_series"),
    )

    symbol_history = relationship("SecuritySymbolHistory", back_populates="security", cascade="all, delete-orphan")
    prices = relationship("StockDailyHistory", back_populates="security")
    corporate_actions = relationship("CorporateAction", back_populates="security")

    @property
    def is_active(self) -> bool:
        if self.status in ("DELISTED", "SUSPENDED", "INACTIVE"):
            return False
        if not self.last_traded_date:
            return False
        from datetime import date
        return self.last_traded_date >= date(2026, 7, 15)

    @property
    def is_delisted(self) -> bool:
        return not self.is_active

    @property
    def trading_status(self) -> str:
        return "ACTIVE" if self.is_active else "DELISTED"


class SecuritySymbolHistory(Base):
    __tablename__ = "security_symbol_history"

    id = Column(PK_ID, primary_key=True, autoincrement=True)
    security_id = Column(BigInteger, ForeignKey("securities.id", ondelete="CASCADE"), nullable=False, index=True)
    symbol = Column(String(100), nullable=False)
    valid_from = Column(Date, nullable=False)
    valid_to = Column(Date, nullable=True)
    change_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    security = relationship("Security", back_populates="symbol_history")


class CorporateAction(Base):
    __tablename__ = "corporate_actions"

    id = Column(PK_ID, primary_key=True, autoincrement=True)
    security_id = Column(BigInteger, ForeignKey("securities.id", ondelete="SET NULL"), nullable=True)
    symbol = Column(String(100), nullable=False)
    series = Column(String(20), nullable=False, default="EQ")
    event_type = Column(String(50), nullable=False)  # SPLIT, BONUS, DIVIDEND, RIGHTS
    ex_date = Column(Date, nullable=False, index=True)
    record_date = Column(Date, nullable=True)
    ratio_numerator = Column(Numeric(18, 6), nullable=True)
    ratio_denominator = Column(Numeric(18, 6), nullable=True)
    amount = Column(Numeric(18, 6), nullable=True)
    notes = Column(Text, nullable=True)
    source_file = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("symbol", "series", "event_type", "ex_date", name="uq_corp_action"),
    )

    security = relationship("Security", back_populates="corporate_actions")


class StockDailyHistory(Base):
    __tablename__ = "stock_daily_history"

    id = Column(PK_ID, primary_key=True, autoincrement=True)
    trade_date = Column(Date, nullable=False, index=True)
    security_id = Column(BigInteger, ForeignKey("securities.id", ondelete="CASCADE"), nullable=False, index=True)
    symbol = Column(String(100), nullable=False)
    series = Column(String(20), nullable=False)

    prev_close = Column(Numeric(18, 6), nullable=True)
    open_price = Column(Numeric(18, 6), nullable=True)
    high_price = Column(Numeric(18, 6), nullable=True)
    low_price = Column(Numeric(18, 6), nullable=True)
    last_price = Column(Numeric(18, 6), nullable=True)
    close_price = Column(Numeric(18, 6), nullable=True)
    vwap = Column(Numeric(18, 6), nullable=True)

    traded_quantity = Column(BigInteger, nullable=True)
    turnover = Column(Numeric(24, 4), nullable=True)
    no_of_trades = Column(BigInteger, nullable=True)
    deliverable_quantity = Column(BigInteger, nullable=True)
    deliverable_pct = Column(Numeric(9, 4), nullable=True)

    source_format = Column(String(40), nullable=False)
    source_file = Column(String(512), nullable=True)
    imported_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("trade_date", "security_id", "series", name="uq_daily_security"),
        Index("idx_symbol_date", "symbol", "trade_date"),
        Index("idx_security_date", "security_id", "trade_date"),
    )

    security = relationship("Security", back_populates="prices")


class IngestionJob(Base):
    __tablename__ = "ingestion_jobs"

    job_id = Column(String(64), primary_key=True)
    job_type = Column(String(50), nullable=False)  # DAILY, BACKFILL, MANUAL, RECOVERY
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    status = Column(String(30), nullable=False, default="PENDING")
    total_dates = Column(BigInteger, default=0)
    successful_dates = Column(BigInteger, default=0)
    failed_dates = Column(BigInteger, default=0)
    total_rows_imported = Column(BigInteger, default=0)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class IngestionFile(Base):
    __tablename__ = "ingestion_files"

    id = Column(PK_ID, primary_key=True, autoincrement=True)
    job_id = Column(String(64), nullable=False, index=True)
    trade_date = Column(Date, nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=True)
    source_url = Column(String(512), nullable=True)
    file_size = Column(BigInteger, nullable=True)
    checksum_sha256 = Column(String(64), nullable=True)
    source_format = Column(String(40), nullable=False)
    parser_version = Column(String(20), nullable=False)
    status = Column(String(30), nullable=False, default="PENDING")
    row_count = Column(BigInteger, default=0)
    parsed_count = Column(BigInteger, default=0)
    inserted_count = Column(BigInteger, default=0)
    updated_count = Column(BigInteger, default=0)
    skipped_count = Column(BigInteger, default=0)
    rejected_count = Column(BigInteger, default=0)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("trade_date", "checksum_sha256", name="uq_date_checksum"),
    )


class IngestionLog(Base):
    __tablename__ = "ingestion_log"

    id = Column(PK_ID, primary_key=True, autoincrement=True)
    job_id = Column(String(64), nullable=False, index=True)
    trade_date = Column(Date, nullable=True)
    stage = Column(String(50), nullable=False)  # DOWNLOAD, PARSE, VALIDATE, UPSERT
    status = Column(String(30), nullable=False)
    details = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class DataQualityIssue(Base):
    __tablename__ = "data_quality_issues"

    id = Column(PK_ID, primary_key=True, autoincrement=True)
    trade_date = Column(Date, nullable=False, index=True)
    symbol = Column(String(100), nullable=True, index=True)
    series = Column(String(20), nullable=True)
    rule_name = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False, default="WARNING", index=True)  # INFO, WARNING, ERROR, CRITICAL
    issue_details = Column(Text, nullable=False)
    raw_data = Column(JSON, nullable=True)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


class User(Base):
    __tablename__ = "users"

    id = Column(PK_ID, primary_key=True, autoincrement=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(120), unique=True, nullable=True, index=True)
    full_name = Column(String(150), nullable=True)
    password_hash = Column(String(255), nullable=False)
    salt = Column(String(64), nullable=False)
    role = Column(String(30), nullable=False, default="user")  # "admin" or "user"
    accessible_screens = Column(JSON, nullable=False, default=list)  # list of screen key strings
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(PK_ID, primary_key=True, autoincrement=True)
    token = Column(String(128), unique=True, nullable=False, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="sessions")

