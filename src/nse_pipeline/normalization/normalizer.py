"""Data Normalizer transforming mapped DataFrames into canonical price records."""

from datetime import date
from typing import Any

import pandas as pd

from nse_pipeline.core.logging import get_logger
from nse_pipeline.normalization.date_normalizer import DateNormalizer
from nse_pipeline.normalization.numeric_normalizer import NumericNormalizer
from nse_pipeline.normalization.symbol_normalizer import SymbolNormalizer

logger = get_logger("normalization.normalizer")


class Normalizer:
    @staticmethod
    def normalize_records(
        df: pd.DataFrame,
        fallback_date: date | None = None,
    ) -> list[dict[str, Any]]:
        """Transforms a mapped DataFrame into clean canonical record dictionaries."""
        records: list[dict[str, Any]] = []

        for _, row in df.iterrows():
            raw_sym = row.get("symbol")
            if not raw_sym or pd.isna(raw_sym):
                continue
            symbol = SymbolNormalizer.normalize_symbol(str(raw_sym))
            if not symbol:
                continue

            series = SymbolNormalizer.normalize_series(row.get("series"))
            isin = SymbolNormalizer.normalize_isin(row.get("isin"))

            # Determine trade date
            raw_date = row.get("trade_date")
            trade_date = DateNormalizer.parse_to_date(raw_date) or fallback_date
            if not trade_date:
                continue

            open_price = NumericNormalizer.parse_float(row.get("open_price"))
            high_price = NumericNormalizer.parse_float(row.get("high_price"))
            low_price = NumericNormalizer.parse_float(row.get("low_price"))
            close_price = NumericNormalizer.parse_float(row.get("close_price"))
            last_price = NumericNormalizer.parse_float(row.get("last_price"))
            prev_close = NumericNormalizer.parse_float(row.get("prev_close"))

            traded_qty = NumericNormalizer.parse_int(row.get("traded_quantity"))
            turnover = NumericNormalizer.parse_float(row.get("turnover"))
            no_of_trades = NumericNormalizer.parse_int(row.get("no_of_trades"))
            deliv_qty = NumericNormalizer.parse_int(row.get("deliverable_quantity"))
            deliv_pct = NumericNormalizer.parse_float(row.get("deliverable_pct"))

            vwap = NumericNormalizer.parse_float(row.get("vwap"))
            # Calculate VWAP if missing and turnover and volume available
            if vwap is None and turnover and traded_qty and traded_qty > 0 and turnover > 0:
                vwap = round(turnover / traded_qty, 4)

            record = {
                "trade_date": trade_date,
                "symbol": symbol,
                "series": series,
                "prev_close": prev_close,
                "open_price": open_price,
                "high_price": high_price,
                "low_price": low_price,
                "last_price": last_price,
                "close_price": close_price,
                "vwap": vwap,
                "traded_quantity": traded_qty,
                "turnover": turnover,
                "no_of_trades": no_of_trades,
                "deliverable_quantity": deliv_qty,
                "deliverable_pct": deliv_pct,
                "isin": isin,
            }
            records.append(record)

        return records
