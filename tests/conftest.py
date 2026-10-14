"""Pytest fixtures for unit and integration testing."""

import zipfile
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import nse_pipeline.database.models  # noqa: F401
from nse_pipeline.database.connection import Base
from nse_pipeline.scheduler.trading_calendar import NSETradingCalendar

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def fixtures_dir() -> Path:
    return FIXTURES_DIR


@pytest.fixture
def legacy_sample_path(fixtures_dir: Path) -> Path:
    return fixtures_dir / "legacy_sample.csv"


@pytest.fixture
def udiff_sample_path(fixtures_dir: Path) -> Path:
    return fixtures_dir / "udiff_sample.csv"


@pytest.fixture
def legacy_zip_path(tmp_path: Path, legacy_sample_path: Path) -> Path:
    zip_p = tmp_path / "cm05JAN2024bhav.csv.zip"
    with zipfile.ZipFile(zip_p, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(legacy_sample_path, arcname="cm05JAN2024bhav.csv")
    return zip_p


@pytest.fixture
def udiff_zip_path(tmp_path: Path, udiff_sample_path: Path) -> Path:
    zip_p = tmp_path / "BhavCopy_NSE_CM_0_0_0_20240708_F_0000.csv.zip"
    with zipfile.ZipFile(zip_p, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(udiff_sample_path, arcname="BhavCopy_NSE_CM_0_0_0_20240708_F_0000.csv")
    return zip_p


@pytest.fixture
def test_db_session(tmp_path: Path):
    """Provides an isolated SQLite database session for tests."""
    db_file = tmp_path / "test_market_data.db"
    engine = create_engine(f"sqlite:///{db_file}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)

    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = Session()

    # Seed calendar for tests
    NSETradingCalendar.seed_calendar(session, start_year=2024, end_year=2024)
    session.commit()

    try:
        yield session
    finally:
        session.close()
        engine.dispose()
