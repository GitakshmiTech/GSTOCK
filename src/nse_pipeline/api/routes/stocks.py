"""Stocks and historical price query endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from nse_pipeline.api.dependencies import get_db
from nse_pipeline.core.clock import parse_date
from nse_pipeline.database.repositories.security_repository import SecurityRepository
from nse_pipeline.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/api/v1/stocks", tags=["Stocks"])


@router.get("/search")
def search_stocks(
    q: str = Query(default="", description="Search query for ticker or company name"),
    limit: int = Query(default=30, le=200),
    db: Session = Depends(get_db),
):
    """Search registered securities in the security master."""
    repo = SecurityRepository(db)
    results = repo.search(query=q, limit=limit)
    return [
        {
            "id": s.id,
            "symbol": s.symbol,
            "series": s.series,
            "company_name": s.company_name or s.symbol,
            "isin": s.isin,
            "status": s.status,
            "first_traded_date": s.first_traded_date.isoformat() if s.first_traded_date else None,
            "last_traded_date": s.last_traded_date.isoformat() if s.last_traded_date else None,
            "is_active": s.is_active,
            "is_delisted": s.is_delisted,
            "trading_status": s.trading_status,
        }
        for s in results
    ]


@router.get("/{symbol}/prices")
def get_stock_price_history(
    symbol: str,
    start: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    series: str = Query("EQ", description="Series code"),
    db: Session = Depends(get_db),
):
    """Retrieve OHLC prices, volume, turnover, moving averages and drawdowns for a stock."""
    start_d = parse_date(start) if start else None
    end_d = parse_date(end) if end else None

    service = AnalyticsService(db)
    return service.get_stock_prices_with_indicators(
        symbol=symbol,
        start_date=start_d,
        end_date=end_d,
        series=series,
    )
