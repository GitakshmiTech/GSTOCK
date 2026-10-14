"""Canonical column mapper for heterogeneous NSE Bhavcopy formats."""

import pandas as pd

from nse_pipeline.core.constants import SourceFormat
from nse_pipeline.core.exceptions import MissingColumnsError

# Canonical mapping dictionaries
LEGACY_COLUMN_MAP = {
    "SYMBOL": "symbol",
    "SERIES": "series",
    "OPEN": "open_price",
    "HIGH": "high_price",
    "LOW": "low_price",
    "CLOSE": "close_price",
    "LAST": "last_price",
    "PREVCLOSE": "prev_close",
    "TOTTRDQTY": "traded_quantity",
    "TOTTRDVAL": "turnover",
    "TOTALTRADES": "no_of_trades",
    "ISIN": "isin",
    "TIMESTAMP": "trade_date",
    "TRADEDATE": "trade_date",
    "DATE": "trade_date",
    "DELIV_QTY": "deliverable_quantity",
    "DELIV_PER": "deliverable_pct",
}

UDIFF_COLUMN_MAP = {
    "TCKRSYMB": "symbol",
    "SCTYSRS": "series",
    "OPNPRIC": "open_price",
    "HGHPRIC": "high_price",
    "LWPRIC": "low_price",
    "CLSPRIC": "close_price",
    "LASTPRIC": "last_price",
    "PRVSCLSGPRIC": "prev_close",
    "TTLTRADGVOL": "traded_quantity",
    "TTLTRFVAL": "turnover",
    "TTLNBOTXSEXCTD": "no_of_trades",
    "TTLNBORTXSEXCTD": "no_of_trades",
    "TTLNBORTXNSEXCTD": "no_of_trades",
    "TTLNOOFTXS": "no_of_trades",
    "ISIN": "isin",
    "TRADDT": "trade_date",
    "BIZDT": "biz_date",
    "SGMT": "segment",
    "FININSTRMTP": "fin_instrm_tp",
    "DLVRYQTY": "deliverable_quantity",
    "DLVRYPER": "deliverable_pct",
}

REQUIRED_CANONICAL_COLUMNS = ["symbol", "close_price", "trade_date"]


class ColumnMapper:
    @staticmethod
    def normalize_column_name(col: str) -> str:
        """Strip spaces, quotes, uppercase."""
        return col.strip().replace('"', "").replace("'", "").upper()

    @classmethod
    def map_columns(
        cls,
        df: pd.DataFrame,
        source_format: SourceFormat,
    ) -> pd.DataFrame:
        """Standardizes DataFrame column names to the canonical schema."""
        raw_columns = list(df.columns)
        mapping_dict = UDIFF_COLUMN_MAP if source_format == SourceFormat.UDIFF_BHAVCOPY else LEGACY_COLUMN_MAP

        rename_map = {}
        for col in raw_columns:
            clean_col = cls.normalize_column_name(col)
            # direct lookup
            if clean_col in mapping_dict:
                rename_map[col] = mapping_dict[clean_col]
            else:
                # partial match support for common variations like TTLNBOFTXSEXCTD
                clean_no_underscore = clean_col.replace("_", "")
                for k, v in mapping_dict.items():
                    if k.replace("_", "") == clean_no_underscore:
                        rename_map[col] = v
                        break

        renamed_df = df.rename(columns=rename_map)

        # Check required columns
        missing = [req for req in REQUIRED_CANONICAL_COLUMNS if req not in renamed_df.columns]
        if missing:
            raise MissingColumnsError(
                f"Missing required canonical columns {missing} after mapping for format {source_format}. "
                f"Original columns: {raw_columns}"
            )

        return renamed_df
