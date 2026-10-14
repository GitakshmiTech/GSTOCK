"""Quantitative analytics endpoints for seasonality and cross-stock comparisons."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from nse_pipeline.api.dependencies import get_db
from nse_pipeline.core.clock import parse_date
from nse_pipeline.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])


@router.get("/seasonality/{symbol}")
def get_stock_seasonality(
    symbol: str,
    series: str = Query("EQ", description="Series code"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    start_year: Optional[int] = Query(None, description="Start year filter, e.g. 2015"),
    end_year: Optional[int] = Query(None, description="End year filter, e.g. 2026"),
    db: Session = Depends(get_db),
):
    """Retrieve monthly return distribution, average monthly seasonality, win-rates and heatmap with optional date filters."""
    service = AnalyticsService(db)
    start_d = parse_date(start_date) if start_date else None
    end_d = parse_date(end_date) if end_date else None
    return service.calculate_seasonality(
        symbol=symbol,
        start_date=start_d,
        end_date=end_d,
        start_year=start_year,
        end_year=end_year,
        series=series,
    )


@router.get("/compare")
def compare_stocks(
    symbols: str = Query(..., description="Comma-separated ticker symbols, e.g. RELIANCE,TCS,INFY"),
    start: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    start_date: Optional[str] = Query(None, description="Start date alias (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date alias (YYYY-MM-DD)"),
    series: str = Query("EQ", description="Series code"),
    db: Session = Depends(get_db),
):
    """Compare multiple stocks rebased to 100, calculating returns, volatility and drawdowns."""
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    s_val = start or start_date
    e_val = end or end_date
    start_d = parse_date(s_val) if s_val else None
    end_d = parse_date(e_val) if e_val else None

    service = AnalyticsService(db)
    return service.compare_stocks(
        symbols=symbol_list,
        start_date=start_d,
        end_date=end_d,
        series=series,
    )
