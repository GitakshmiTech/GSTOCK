"""Schemas for quantitative analysis and seasonality responses."""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class PriceIndicatorItem(BaseModel):
    trade_date: str
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: Optional[float] = None
    volume: Optional[int] = None
    turnover: Optional[float] = None
    prev_close: Optional[float] = None
    daily_return: Optional[float] = None
    sma_20: Optional[float] = None
    sma_50: Optional[float] = None
    sma_200: Optional[float] = None
    cumulative_return: Optional[float] = None
    drawdown: Optional[float] = None


class StockIndicatorSummary(BaseModel):
    latest_close: Optional[float] = None
    total_return_pct: Optional[float] = None
    annualized_volatility_pct: Optional[float] = None
    max_drawdown_pct: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class StockPricesWithIndicatorsResponse(BaseModel):
    symbol: str
    series: str
    records_count: int
    summary: StockIndicatorSummary
    data: List[PriceIndicatorItem]
    prices: List[PriceIndicatorItem]


class SeasonalityResponse(BaseModel):
    symbol: str
    monthly_averages: Dict[str, float]
    monthly_seasonality: Dict[str, float]
    win_rates: Dict[str, Dict[str, Any]]
    heatmap: List[Dict[str, Any]]


class StockComparisonItem(BaseModel):
    symbol: str
    base_price: float
    latest_close: Optional[float] = None
    cumulative_return_pct: float
    annualized_volatility_pct: float
    max_drawdown_pct: float
    data_points: int


class StockComparisonResponse(BaseModel):
    symbols: List[str]
    summary: List[StockComparisonItem]
    summary_stats: List[StockComparisonItem]
    series: Dict[str, List[Dict[str, Any]]]
