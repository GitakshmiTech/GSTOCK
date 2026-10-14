"""Export service for exporting OHLCV and market data to CSV and Excel."""

from datetime import date
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

from nse_pipeline.core.config import get_settings
from nse_pipeline.core.logging import get_logger
from nse_pipeline.database.repositories.price_repository import PriceRepository

logger = get_logger("services.export")


class ExportService:
    def __init__(self, session: Session):
        self.session = session
        self.price_repo = PriceRepository(session)
        self.settings = get_settings()

    def export_symbol_history(
        self,
        symbol: str,
        start_date: date | None = None,
        end_date: date | None = None,
        series: str = "EQ",
        format_type: str = "csv",
    ) -> Path:
        """Exports price history for a symbol to CSV or Excel."""
        records = self.price_repo.get_prices(
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            series=series,
            limit=100000,
        )

        data = [
            {
                "trade_date": r.trade_date,
                "symbol": r.symbol,
                "series": r.series,
                "open": float(r.open_price) if r.open_price is not None else None,
                "high": float(r.high_price) if r.high_price is not None else None,
                "low": float(r.low_price) if r.low_price is not None else None,
                "close": float(r.close_price) if r.close_price is not None else None,
                "last": float(r.last_price) if r.last_price is not None else None,
                "prev_close": float(r.prev_close) if r.prev_close is not None else None,
                "vwap": float(r.vwap) if r.vwap is not None else None,
                "traded_quantity": r.traded_quantity,
                "turnover": float(r.turnover) if r.turnover is not None else None,
                "no_of_trades": r.no_of_trades,
                "deliverable_quantity": r.deliverable_quantity,
                "deliverable_pct": float(r.deliverable_pct) if r.deliverable_pct is not None else None,
            }
            for r in records
        ]

        df = pd.DataFrame(data)
        exports_dir = Path(self.settings.exports_dir)
        exports_dir.mkdir(parents=True, exist_ok=True)

        sym_clean = symbol.strip().upper()
        fmt = format_type.lower()
        if fmt == "excel" or fmt == "xlsx":
            out_file = exports_dir / f"{sym_clean}_{series}_history.xlsx"
            df.to_excel(out_file, index=False)
        else:
            out_file = exports_dir / f"{sym_clean}_{series}_history.csv"
            df.to_csv(out_file, index=False)

        logger.info(f"Exported {len(df)} rows for {sym_clean} to {out_file}")
        return out_file
