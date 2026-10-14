"""Pydantic schemas for price queries and securities."""

from datetime import date

from pydantic import BaseModel, ConfigDict


class PriceRecordSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    trade_date: date
    symbol: str
    series: str
    prev_close: float | None = None
    open_price: float | None = None
    high_price: float | None = None
    low_price: float | None = None
    last_price: float | None = None
    close_price: float | None = None
    vwap: float | None = None
    traded_quantity: int | None = None
    turnover: float | None = None
    no_of_trades: int | None = None
    deliverable_quantity: int | None = None
    deliverable_pct: float | None = None


class SecuritySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    symbol: str
    series: str
    company_name: str | None = None
    isin: str | None = None
    status: str
    first_traded_date: date | None = None
    last_traded_date: date | None = None


class DailyMarketItemSchema(BaseModel):
    id: int
    symbol: str
    series: str
    company_name: str | None = None
    trade_date: str
    open_price: float | None = None
    high_price: float | None = None
    low_price: float | None = None
    close_price: float | None = None
    prev_close: float | None = None
    last_price: float | None = None
    vwap: float | None = None
    change: float
    change_pct: float
    traded_quantity: int
    turnover: float
    turnover_cr: float


class DailyMarketSummarySchema(BaseModel):
    total_stocks: int
    advances: int
    declines: int
    unchanged: int
    total_turnover_cr: float
    total_volume: int


class DailyMarketResponseSchema(BaseModel):
    trade_date: str | None = None
    latest_date: str | None = None
    available_dates: list[str] = []
    summary: DailyMarketSummarySchema
    total_count: int
    page: int
    page_size: int
    total_pages: int
    items: list[DailyMarketItemSchema]

