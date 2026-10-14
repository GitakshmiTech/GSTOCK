"""Endpoints for querying OHLCV market price history."""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from nse_pipeline.api.dependencies import get_db
from nse_pipeline.api.schemas.prices import DailyMarketResponseSchema, PriceRecordSchema
from nse_pipeline.database.repositories.price_repository import PriceRepository

router = APIRouter(prefix="/api/v1/prices", tags=["Prices"])


@router.get("/daily-market", response_model=DailyMarketResponseSchema)
def get_daily_market_ohlc(
    trade_date: date | None = None,
    series: str | None = "EQ",
    search: str | None = None,
    sort_by: str = Query(default="turnover", description="Field to sort by"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    filter_type: str = Query(default="ALL", description="ALL, GAINERS, LOSERS, UNCHANGED, BIG_GAINERS, BIG_LOSERS"),
    limit: int = Query(default=100, ge=1, le=1000),
    page: int = Query(default=1, ge=1),
    db: Session = Depends(get_db),
):
    """Retrieve full market daily OHLC bars across all stocks for a specific date."""
    repo = PriceRepository(db)
    offset = (page - 1) * limit
    return repo.get_daily_market_ohlc(
        trade_date=trade_date,
        series=series,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        filter_type=filter_type,
        limit=limit,
        offset=offset,
    )


@router.get("/{symbol}", response_model=list[PriceRecordSchema])
def get_symbol_prices(
    symbol: str,
    start_date: date | None = None,
    end_date: date | None = None,
    series: str | None = "EQ",
    limit: int = Query(default=1000, le=5000),
    db: Session = Depends(get_db),
):
    """Retrieve historical daily price bars for a given symbol."""
    repo = PriceRepository(db)
    return repo.get_prices(
        symbol=symbol,
        start_date=start_date,
        end_date=end_date,
        series=series,
        limit=limit,
    )


@router.get("", response_model=list[PriceRecordSchema])
def filter_prices(
    trade_date: date | None = None,
    symbol: str | None = None,
    series: str | None = None,
    limit: int = Query(default=500, le=5000),
    db: Session = Depends(get_db),
):
    """Filter market prices by date, symbol or series."""
    repo = PriceRepository(db)
    if trade_date:
        return repo.get_by_date(trade_date=trade_date, series=series)[:limit]
    elif symbol:
        return repo.get_prices(symbol=symbol, series=series, limit=limit)
    return []
