"""Corporate Action Service for parsing and tracking corporate events."""

from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

from nse_pipeline.core.logging import get_logger
from nse_pipeline.database.models import CorporateAction
from nse_pipeline.database.repositories.corporate_action_repository import (
    CorporateActionRepository,
)
from nse_pipeline.database.repositories.security_repository import SecurityRepository
from nse_pipeline.normalization.date_normalizer import DateNormalizer
from nse_pipeline.normalization.numeric_normalizer import NumericNormalizer
from nse_pipeline.normalization.symbol_normalizer import SymbolNormalizer

logger = get_logger("services.corporate_action")


class CorporateActionService:
    def __init__(self, session: Session):
        self.session = session
        self.repo = CorporateActionRepository(session)
        self.sec_repo = SecurityRepository(session)

    def import_from_csv(self, file_path: str | Path) -> int:
        """Imports corporate actions from CSV."""
        df = pd.read_csv(file_path, dtype=str)
        count = 0

        for _, row in df.iterrows():
            sym = SymbolNormalizer.normalize_symbol(row.get("symbol", row.get("SYMBOL", "")))
            srs = SymbolNormalizer.normalize_series(row.get("series", row.get("SERIES", "EQ")))
            event_type = str(row.get("event_type", row.get("EVENT_TYPE", "OTHER"))).strip().upper()

            ex_date_raw = row.get("ex_date", row.get("EX_DATE"))
            ex_date = DateNormalizer.parse_to_date(ex_date_raw)
            if not sym or not ex_date:
                continue

            sec = self.sec_repo.get_or_create(sym, srs)

            action_data = {
                "security_id": sec.id,
                "symbol": sym,
                "series": srs,
                "event_type": event_type,
                "ex_date": ex_date,
                "record_date": DateNormalizer.parse_to_date(row.get("record_date", row.get("RECORD_DATE"))),
                "ratio_numerator": NumericNormalizer.parse_float(row.get("ratio_numerator")),
                "ratio_denominator": NumericNormalizer.parse_float(row.get("ratio_denominator")),
                "amount": NumericNormalizer.parse_float(row.get("amount")),
                "notes": str(row.get("notes", row.get("PURPOSE", ""))).strip(),
                "source_file": Path(file_path).name,
            }
            self.repo.upsert(action_data)
            count += 1

        self.session.commit()
        logger.info(f"Imported {count} corporate actions from {file_path}")
        return count

    def get_actions_for_symbol(self, symbol: str) -> list[CorporateAction]:
        return self.repo.get_by_symbol(symbol)
