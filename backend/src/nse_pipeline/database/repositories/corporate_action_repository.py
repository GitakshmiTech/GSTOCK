"""Repository for corporate actions management."""

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from nse_pipeline.database.models import CorporateAction


class CorporateActionRepository:
    def __init__(self, session: Session):
        self.session = session

    def upsert(self, data: dict[str, Any]) -> CorporateAction:
        """Finds or creates/updates a corporate action record."""
        symbol = str(data["symbol"]).strip().upper()
        series = str(data.get("series", "EQ")).strip().upper()
        event_type = str(data["event_type"]).strip().upper()
        ex_date = data["ex_date"]

        stmt = select(CorporateAction).where(
            CorporateAction.symbol == symbol,
            CorporateAction.series == series,
            CorporateAction.event_type == event_type,
            CorporateAction.ex_date == ex_date,
        )
        existing = self.session.execute(stmt).scalar_one_or_none()

        if existing:
            for k, v in data.items():
                if hasattr(existing, k) and v is not None:
                    setattr(existing, k, v)
            return existing

        new_action = CorporateAction(
            security_id=data.get("security_id"),
            symbol=symbol,
            series=series,
            event_type=event_type,
            ex_date=ex_date,
            record_date=data.get("record_date"),
            ratio_numerator=data.get("ratio_numerator"),
            ratio_denominator=data.get("ratio_denominator"),
            amount=data.get("amount"),
            notes=data.get("notes"),
            source_file=data.get("source_file"),
        )
        self.session.add(new_action)
        self.session.flush()
        return new_action

    def get_by_symbol(self, symbol: str) -> list[CorporateAction]:
        stmt = (
            select(CorporateAction)
            .where(CorporateAction.symbol == symbol.strip().upper())
            .order_by(CorporateAction.ex_date.desc())
        )
        return list(self.session.execute(stmt).scalars().all())

    def get_by_date_range(self, start_date: date, end_date: date) -> list[CorporateAction]:
        stmt = (
            select(CorporateAction)
            .where(
                CorporateAction.ex_date >= start_date,
                CorporateAction.ex_date <= end_date,
            )
            .order_by(CorporateAction.ex_date.asc())
        )
        return list(self.session.execute(stmt).scalars().all())
