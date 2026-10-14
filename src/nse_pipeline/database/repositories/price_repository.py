"""Repository for daily price queries and bulk operations."""

from datetime import date
from typing import Any

from sqlalchemy import asc, case, desc, func, select
from sqlalchemy.orm import Session

from nse_pipeline.database.bulk_upsert import bulk_upsert_stock_history
from nse_pipeline.database.models import Security, StockDailyHistory


# Canonical symbol aliases for historical entity mergers / renamings
SYMBOL_ALIASES: dict[str, str] = {
    "BIRLA3M": "3MINDIA",
    "ICICI": "ICICIBANK",
    "UTIBANK": "AXISBANK",
    "HEROHONDA": "HEROMOTOCO",
    "ADANIEXPO": "ADANIENT",
    "CENTURYTEX": "ABREL",
    "BOOTSPHARM": "ABBOTINDIA",
    "KALECONSUL": "ACCELYA",
    "ADVANIORLI": "ADOR",
    "ADORWELD": "ADOR",
}

# Mapping of canonical symbols to all tickers the entity ever traded under
CANONICAL_FAMILIES: dict[str, list[str]] = {
    "3MINDIA": ["3MINDIA", "BIRLA3M"],
    "ICICIBANK": ["ICICIBANK", "ICICI"],
    "AXISBANK": ["AXISBANK", "UTIBANK"],
    "HEROMOTOCO": ["HEROMOTOCO", "HEROHONDA"],
    "ADANIENT": ["ADANIENT", "ADANIEXPO"],
    "ABREL": ["ABREL", "CENTURYTEX"],
    "ABBOTINDIA": ["ABBOTINDIA", "BOOTSPHARM"],
    "ACCELYA": ["ACCELYA", "KALECONSUL"],
    "ADOR": ["ADOR", "ADORWELD", "ADVANIORLI"],
}


def resolve_query_symbols(symbol: str) -> list[str]:
    """Resolves a symbol to all historical ticker symbols under that entity."""
    clean = symbol.strip().upper()
    canonical = SYMBOL_ALIASES.get(clean, clean)
    family = CANONICAL_FAMILIES.get(canonical)
    if family:
        return list(dict.fromkeys([canonical] + family))
    return [canonical]


class PriceRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_prices(
        self,
        symbol: str,
        start_date: date | None = None,
        end_date: date | None = None,
        series: str | None = "EQ",
        limit: int = 50000,
    ) -> list[StockDailyHistory]:
        """Fetch historical price bars for a given symbol and date range.
        
        For standard equity queries (series='EQ', 'ALL', or None), automatically includes
        related equity series (EQ, BE, SM, BZ) to seamlessly support stocks that migrated
        from SME (SM) to Mainboard (EQ) or entered surveillance (BE) periods, deduplicating
        by date with priority EQ > BE > SM > BZ. Automatically maps alias symbols like
        BIRLA3M to 3MINDIA and ICICI to ICICIBANK for full 26-year continuous data.
        """
        query_syms = resolve_query_symbols(symbol)
        # If specific non-standard series requested (e.g. debt/block deal), filter strictly
        if series and series.strip().upper() not in ("EQ", "ALL"):
            stmt = select(StockDailyHistory).where(
                StockDailyHistory.symbol.in_(query_syms),
                StockDailyHistory.series == series.strip().upper(),
            )
            if start_date:
                stmt = stmt.where(StockDailyHistory.trade_date >= start_date)
            if end_date:
                stmt = stmt.where(StockDailyHistory.trade_date <= end_date)
            stmt = stmt.order_by(StockDailyHistory.trade_date.asc()).limit(limit)
            return list(self.session.execute(stmt).scalars().all())

        # Standard equity series: include EQ, BE, SM, BZ
        equity_series = ["EQ", "BE", "SM", "BZ"]
        stmt = select(StockDailyHistory).where(
            StockDailyHistory.symbol.in_(query_syms),
            StockDailyHistory.series.in_(equity_series),
        )
        if start_date:
            stmt = stmt.where(StockDailyHistory.trade_date >= start_date)
        if end_date:
            stmt = stmt.where(StockDailyHistory.trade_date <= end_date)

        stmt = stmt.order_by(StockDailyHistory.trade_date.asc())
        all_records = list(self.session.execute(stmt).scalars().all())

        if not all_records:
            return []

        priority = {"EQ": 1, "BE": 2, "SM": 3, "BZ": 4}
        seen: dict[date, StockDailyHistory] = {}
        for rec in all_records:
            t_date = rec.trade_date
            if t_date not in seen:
                seen[t_date] = rec
            else:
                existing_prio = priority.get(seen[t_date].series, 99)
                current_prio = priority.get(rec.series, 99)
                if current_prio < existing_prio:
                    seen[t_date] = rec

        deduped = sorted(seen.values(), key=lambda r: r.trade_date)
        return deduped[:limit]

    def get_latest_price(self, symbol: str, series: str = "EQ") -> StockDailyHistory | None:
        """Fetch the most recent daily price for a symbol."""
        query_syms = resolve_query_symbols(symbol)
        stmt = (
            select(StockDailyHistory)
            .where(
                StockDailyHistory.symbol.in_(query_syms),
                StockDailyHistory.series == series.strip().upper(),
            )
            .order_by(desc(StockDailyHistory.trade_date))
            .limit(1)
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def get_by_date(self, trade_date: date, series: str | None = None) -> list[StockDailyHistory]:
        """Fetch all securities prices for a specific trade date."""
        stmt = select(StockDailyHistory).where(StockDailyHistory.trade_date == trade_date)
        if series:
            stmt = stmt.where(StockDailyHistory.series == series.strip().upper())
        stmt = stmt.order_by(StockDailyHistory.turnover.desc())
        return list(self.session.execute(stmt).scalars().all())

    def get_distinct_dates(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[date]:
        """Returns all distinct trade dates stored in stock_daily_history."""
        stmt = select(StockDailyHistory.trade_date).distinct()
        if start_date:
            stmt = stmt.where(StockDailyHistory.trade_date >= start_date)
        if end_date:
            stmt = stmt.where(StockDailyHistory.trade_date <= end_date)
        stmt = stmt.order_by(StockDailyHistory.trade_date.asc())
        return list(self.session.execute(stmt).scalars().all())

    def count_by_date(self, trade_date: date) -> int:
        """Count rows for a specific trade date."""
        stmt = select(func.count(StockDailyHistory.id)).where(StockDailyHistory.trade_date == trade_date)
        return self.session.execute(stmt).scalar() or 0

    def bulk_upsert(self, records: list[dict[str, Any]], batch_size: int = 1000) -> int:
        """Bulk upserts price records using the optimized dialect handler."""
        return bulk_upsert_stock_history(self.session, records, batch_size=batch_size)

    def get_latest_trade_date(self) -> date | None:
        """Returns the most recent trade date stored in the history table."""
        stmt = select(func.max(StockDailyHistory.trade_date))
        return self.session.execute(stmt).scalar()

    def get_recent_trade_dates(self, limit: int = 20) -> list[date]:
        """Returns the most recent N distinct trade dates ordered descending."""
        stmt = (
            select(StockDailyHistory.trade_date)
            .distinct()
            .order_by(StockDailyHistory.trade_date.desc())
            .limit(limit)
        )
        return list(self.session.execute(stmt).scalars().all())

    def get_daily_market_ohlc(
        self,
        trade_date: date | None = None,
        series: str | None = "EQ",
        search: str | None = None,
        sort_by: str = "turnover",
        sort_order: str = "desc",
        filter_type: str = "ALL",
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """Queries daily OHLC market quotes across all stocks for a given trading date.

        Returns breadcrumb summary metrics (advances, declines, unchanged, total turnover, total volume)
        and paginated list of stock rows with company names.
        """
        # 1. Determine trade date
        target_date = trade_date or self.get_latest_trade_date()
        if not target_date:
            return {
                "trade_date": None,
                "latest_date": None,
                "available_dates": [],
                "summary": {
                    "total_stocks": 0,
                    "advances": 0,
                    "declines": 0,
                    "unchanged": 0,
                    "total_turnover_cr": 0.0,
                    "total_volume": 0,
                },
                "total_count": 0,
                "page": 1,
                "page_size": limit,
                "total_pages": 0,
                "items": [],
            }

        # 2. Get recent dates for fast quick-switching in UI
        recent_dates = self.get_recent_trade_dates(limit=20)
        latest_date = recent_dates[0] if recent_dates else target_date

        # 3. Overall Market Breadth summary on this date
        summary_stmt = select(
            func.count(StockDailyHistory.id).label("total_stocks"),
            func.count(case((StockDailyHistory.close_price > StockDailyHistory.prev_close, 1))).label("advances"),
            func.count(case((StockDailyHistory.close_price < StockDailyHistory.prev_close, 1))).label("declines"),
            func.count(case((StockDailyHistory.close_price == StockDailyHistory.prev_close, 1))).label("unchanged"),
            func.sum(StockDailyHistory.turnover).label("tot_turnover"),
            func.sum(StockDailyHistory.traded_quantity).label("tot_volume"),
        ).where(StockDailyHistory.trade_date == target_date)

        if series and series.upper() != "ALL":
            summary_stmt = summary_stmt.where(StockDailyHistory.series == series.upper())

        sum_res = self.session.execute(summary_stmt).one()
        tot_turnover = float(sum_res.tot_turnover or 0.0)

        summary = {
            "total_stocks": sum_res.total_stocks or 0,
            "advances": sum_res.advances or 0,
            "declines": sum_res.declines or 0,
            "unchanged": sum_res.unchanged or 0,
            "total_turnover_cr": round(tot_turnover / 10000000.0, 2),
            "total_volume": int(sum_res.tot_volume or 0),
        }

        # 4. Filtered query for the paginated table
        base_query = (
            select(
                StockDailyHistory.id,
                StockDailyHistory.symbol,
                StockDailyHistory.series,
                StockDailyHistory.trade_date,
                StockDailyHistory.open_price,
                StockDailyHistory.high_price,
                StockDailyHistory.low_price,
                StockDailyHistory.close_price,
                StockDailyHistory.prev_close,
                StockDailyHistory.last_price,
                StockDailyHistory.vwap,
                StockDailyHistory.traded_quantity,
                StockDailyHistory.turnover,
                Security.company_name,
            )
            .outerjoin(Security, StockDailyHistory.security_id == Security.id)
            .where(StockDailyHistory.trade_date == target_date)
        )

        if series and series.upper() != "ALL":
            base_query = base_query.where(StockDailyHistory.series == series.upper())

        if search:
            s_term = f"%{search.strip().upper()}%"
            base_query = base_query.where(
                (StockDailyHistory.symbol.like(s_term))
                | (func.upper(Security.company_name).like(s_term))
            )

        f_type = (filter_type or "ALL").upper()
        if f_type == "GAINERS":
            base_query = base_query.where(StockDailyHistory.close_price > StockDailyHistory.prev_close)
        elif f_type == "LOSERS":
            base_query = base_query.where(StockDailyHistory.close_price < StockDailyHistory.prev_close)
        elif f_type == "UNCHANGED":
            base_query = base_query.where(StockDailyHistory.close_price == StockDailyHistory.prev_close)
        elif f_type == "BIG_GAINERS":
            base_query = base_query.where(
                (StockDailyHistory.close_price - StockDailyHistory.prev_close) / func.nullif(StockDailyHistory.prev_close, 0) >= 0.05
            )
        elif f_type == "BIG_LOSERS":
            base_query = base_query.where(
                (StockDailyHistory.close_price - StockDailyHistory.prev_close) / func.nullif(StockDailyHistory.prev_close, 0) <= -0.05
            )

        # Count total matching rows
        count_stmt = select(func.count()).select_from(base_query.subquery())
        total_count = self.session.execute(count_stmt).scalar() or 0

        # Sort order
        sort_col_map = {
            "symbol": StockDailyHistory.symbol,
            "open_price": StockDailyHistory.open_price,
            "high_price": StockDailyHistory.high_price,
            "low_price": StockDailyHistory.low_price,
            "close_price": StockDailyHistory.close_price,
            "prev_close": StockDailyHistory.prev_close,
            "change_pct": (StockDailyHistory.close_price - StockDailyHistory.prev_close) / func.nullif(StockDailyHistory.prev_close, 0),
            "traded_quantity": StockDailyHistory.traded_quantity,
            "turnover": StockDailyHistory.turnover,
        }
        sort_expr = sort_col_map.get(sort_by, StockDailyHistory.turnover)
        if sort_order.lower() == "asc":
            base_query = base_query.order_by(asc(sort_expr))
        else:
            base_query = base_query.order_by(desc(sort_expr))

        # Paginate
        base_query = base_query.offset(offset).limit(limit)
        records = self.session.execute(base_query).all()

        items = []
        for r in records:
            close = float(r.close_price) if r.close_price is not None else 0.0
            prev = float(r.prev_close) if r.prev_close is not None else close
            change = round(close - prev, 2)
            change_pct = round((change / prev) * 100.0, 2) if prev != 0 else 0.0
            turnover_val = float(r.turnover) if r.turnover is not None else 0.0
            turnover_cr = round(turnover_val / 10000000.0, 2)

            items.append({
                "id": r.id,
                "symbol": r.symbol,
                "series": r.series,
                "company_name": r.company_name if (r.company_name and r.company_name != r.symbol) else None,
                "trade_date": str(r.trade_date),

                "open_price": float(r.open_price) if r.open_price is not None else None,
                "high_price": float(r.high_price) if r.high_price is not None else None,
                "low_price": float(r.low_price) if r.low_price is not None else None,
                "close_price": close,
                "prev_close": prev,
                "last_price": float(r.last_price) if r.last_price is not None else None,
                "vwap": float(r.vwap) if r.vwap is not None else None,
                "change": change,
                "change_pct": change_pct,
                "traded_quantity": int(r.traded_quantity) if r.traded_quantity is not None else 0,
                "turnover": turnover_val,
                "turnover_cr": turnover_cr,
            })

        total_pages = (total_count + limit - 1) // limit if limit > 0 else 1
        page_num = (offset // limit) + 1 if limit > 0 else 1

        return {
            "trade_date": str(target_date),
            "latest_date": str(latest_date),
            "available_dates": [str(d) for d in recent_dates],
            "summary": summary,
            "total_count": total_count,
            "page": page_num,
            "page_size": limit,
            "total_pages": total_pages,
            "items": items,
        }

