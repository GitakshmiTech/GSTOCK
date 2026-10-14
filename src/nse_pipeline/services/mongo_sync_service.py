"""High-performance synchronization service from SQL (SQLite/MySQL) to MongoDB.

Allows migrating and streaming all historical securities, trading calendar,
and stock daily price history records into MongoDB collections for MongoDB Compass.
"""

from datetime import date, datetime
import logging
import time
from typing import Callable, Any

from sqlalchemy import select, func, text
from sqlalchemy.orm import Session
from pymongo import UpdateOne

from nse_pipeline.core.config import get_settings
from nse_pipeline.database.mongo import (
    get_mongo_db,
    init_mongo_indexes,
    sanitize_doc,
    get_mongo_stats,
)
from nse_pipeline.database.session import get_db_session

logger = logging.getLogger("nse_pipeline.services.mongo_sync")


class MongoSyncService:
    """Orchestrates syncing data from the primary SQL store to MongoDB."""

    def __init__(self, session: Session | None = None):
        self._provided_session = session
        init_mongo_indexes()

    def sync_securities(self, on_progress: Callable[[int, int], None] | None = None) -> int:
        """Syncs all securities metadata into the MongoDB 'securities' collection."""
        db = get_mongo_db()
        col = db.securities

        with (self._provided_session if self._provided_session else get_db_session()) as session:
            rows = session.execute(
                text("SELECT id, symbol, series, company_name, isin, status, first_traded_date, last_traded_date FROM securities")
            ).mappings().all()

        total = len(rows)
        logger.info(f"Syncing {total:,} securities to MongoDB...")

        ops = []
        for r in rows:
            doc = sanitize_doc(dict(r))
            sym = doc.get("symbol")
            ser = doc.get("series", "EQ")
            if not sym:
                continue
            ops.append(
                UpdateOne(
                    {"symbol": sym, "series": ser},
                    {"$set": doc},
                    upsert=True,
                )
            )

        if ops:
            col.bulk_write(ops, ordered=False)

        if on_progress:
            on_progress(total, total)

        logger.info(f"Successfully synced {total:,} securities to MongoDB collection 'securities'.")
        return total

    def sync_trading_calendar(self) -> int:
        """Syncs trading calendar dates and holiday flags into MongoDB 'trading_calendar'."""
        db = get_mongo_db()
        col = db.trading_calendar

        with (self._provided_session if self._provided_session else get_db_session()) as session:
            rows = session.execute(
                text("SELECT trade_date, session_type, is_trading_day, is_holiday, holiday_name, is_weekend FROM trading_calendar")
            ).mappings().all()

        total = len(rows)
        logger.info(f"Syncing {total:,} calendar days to MongoDB...")

        ops = []
        for r in rows:
            doc = sanitize_doc(dict(r))
            c_date = doc.get("trade_date")
            if not c_date:
                continue
            ops.append(
                UpdateOne(
                    {"trade_date": c_date},
                    {"$set": doc},
                    upsert=True,
                )
            )

        if ops:
            col.bulk_write(ops, ordered=False)

        logger.info(f"Successfully synced {total:,} calendar records to MongoDB collection 'trading_calendar'.")
        return total

    def sync_stock_history(
        self,
        start_date: str | None = None,
        end_date: str | None = None,
        symbols: list[str] | None = None,
        batch_size: int = 10000,
        on_progress: Callable[[int, int, str], None] | None = None,
    ) -> int:
        """Streams stock daily history from SQL to MongoDB in high-throughput bulk batches."""
        db = get_mongo_db()
        col = db.stock_daily_history

        where_clauses = []
        params: dict[str, Any] = {}

        if start_date:
            where_clauses.append("trade_date >= :start_date")
            params["start_date"] = start_date
        if end_date:
            where_clauses.append("trade_date <= :end_date")
            params["end_date"] = end_date
        if symbols:
            clean_syms = [s.strip().upper() for s in symbols]
            where_clauses.append(f"symbol IN ({', '.join(repr(s) for s in clean_syms)})")

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        with (self._provided_session if self._provided_session else get_db_session()) as session:
            count_query = text(f"SELECT COUNT(*) FROM stock_daily_history {where_sql}")
            total_rows = session.execute(count_query, params).scalar() or 0

            logger.info(f"Preparing to sync {total_rows:,} daily price records to MongoDB (Batch size: {batch_size:,})...")

            select_sql = text(f"""
                SELECT trade_date, symbol, series, prev_close, open_price, high_price,
                       low_price, last_price, close_price, vwap, traded_quantity, turnover,
                       no_of_trades, deliverable_quantity, deliverable_pct
                FROM stock_daily_history
                {where_sql}
                ORDER BY trade_date ASC
            """)

            result_proxy = session.execute(select_sql, params)

            processed = 0
            start_time = time.time()

            while True:
                chunk = result_proxy.fetchmany(batch_size)
                if not chunk:
                    break

                ops = []
                for row in chunk:
                    doc = sanitize_doc(dict(row._mapping))
                    sym = doc.get("symbol")
                    ser = doc.get("series", "EQ")
                    t_date = doc.get("trade_date")
                    if not sym or not t_date:
                        continue

                    ops.append(
                        UpdateOne(
                            {"symbol": sym, "series": ser, "trade_date": t_date},
                            {"$set": doc},
                            upsert=True,
                        )
                    )

                if ops:
                    col.bulk_write(ops, ordered=False)

                processed += len(chunk)
                elapsed = time.time() - start_time
                rate = processed / elapsed if elapsed > 0 else 0
                msg = f"Synced {processed:,}/{total_rows:,} ({processed/total_rows*100:.1f}%) at {rate:.0f} docs/sec"
                logger.info(msg)

                if on_progress:
                    on_progress(processed, total_rows, msg)

        logger.info(f"Finished syncing {processed:,} stock price records to MongoDB collection 'stock_daily_history'.")
        return processed
