"""Schemas for dashboard overview and market movers."""

from datetime import date
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class MoverItemSchema(BaseModel):
    symbol: str
    series: str
    company_name: Optional[str] = None
    close_price: Optional[float] = None
    prev_close: Optional[float] = None
    change: Optional[float] = None
    change_pct: Optional[float] = None
    pChange: Optional[float] = None
    turnover: Optional[float] = None
    volume: Optional[int] = None


class MarketOverviewSchema(BaseModel):
    latest_date: Optional[date] = None
    total_securities_count: int = 0
    advances: int = 0
    declines: int = 0
    unchanged: int = 0
    total_turnover: float = 0.0
    total_volume: int = 0
    top_gainers: List[MoverItemSchema] = []
    top_losers: List[MoverItemSchema] = []
    most_active: List[MoverItemSchema] = []
    latest_job: Optional[Dict[str, Any]] = None
