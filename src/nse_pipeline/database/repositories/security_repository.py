"""Repository for managing securities and symbol history."""

from datetime import date
from typing import Any

from sqlalchemy import asc, case, desc, or_, select
from sqlalchemy.orm import Session

from nse_pipeline.database.models import Security, SecuritySymbolHistory


class SecurityRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_or_create(
        self,
        symbol: str,
        series: str = "EQ",
        isin: str | None = None,
        company_name: str | None = None,
        trade_date: date | None = None,
    ) -> Security:
        """Finds an existing security by symbol and series, or creates a new one."""
        clean_symbol = symbol.strip().upper()
        clean_series = series.strip().upper()

        stmt = select(Security).where(
            Security.symbol == clean_symbol,
            Security.series == clean_series,
        )
        sec = self.session.execute(stmt).scalar_one_or_none()

        if sec:
            # Update ISIN or company name if previously missing
            if isin and not sec.isin:
                sec.isin = isin.strip().upper()
            if company_name and not sec.company_name:
                sec.company_name = company_name.strip()
            if trade_date:
                if sec.first_traded_date is None or trade_date < sec.first_traded_date:
                    sec.first_traded_date = trade_date
                if sec.last_traded_date is None or trade_date > sec.last_traded_date:
                    sec.last_traded_date = trade_date
            return sec

        new_sec = Security(
            symbol=clean_symbol,
            series=clean_series,
            isin=isin.strip().upper() if isin else None,
            company_name=company_name.strip() if company_name else None,
            first_traded_date=trade_date,
            last_traded_date=trade_date,
        )
        self.session.add(new_sec)
        self.session.flush()
        return new_sec

    def bulk_resolve_security_ids(
        self,
        items: list[dict[str, Any]],
        trade_date: date | None = None,
    ) -> dict[tuple[str, str], int]:
        """Resolves security IDs in bulk, caching in memory and creating missing records in one pass."""
        # Find unique pairs
        unique_pairs = set()
        for item in items:
            sym = str(item.get("symbol", "")).strip().upper()
            srs = str(item.get("series", "EQ")).strip().upper()
            if sym:
                unique_pairs.add((sym, srs))

        if not unique_pairs:
            return {}

        # Fetch all existing
        mapping: dict[tuple[str, str], int] = {}
        symbols = list({p[0] for p in unique_pairs})

        # Batch lookup by symbols
        stmt = select(Security).where(Security.symbol.in_(symbols))
        existing_secs = self.session.execute(stmt).scalars().all()

        for sec in existing_secs:
            mapping[(sec.symbol, sec.series)] = sec.id
            if trade_date:
                if sec.first_traded_date is None or trade_date < sec.first_traded_date:
                    sec.first_traded_date = trade_date
                if sec.last_traded_date is None or trade_date > sec.last_traded_date:
                    sec.last_traded_date = trade_date

        # Insert missing pairs
        new_objects = []
        for sym, srs in unique_pairs:
            if (sym, srs) not in mapping:
                # Find ISIN and company_name from items if available
                isin = None
                company_name = None
                for itm in items:
                    if str(itm.get("symbol", "")).strip().upper() == sym and str(itm.get("series", "")).strip().upper() == srs:
                        isin = itm.get("isin")
                        company_name = itm.get("company_name")
                        break
                new_sec = Security(
                    symbol=sym,
                    series=srs,
                    company_name=company_name,
                    isin=isin.strip().upper() if isin else None,
                    first_traded_date=trade_date,
                    last_traded_date=trade_date,
                )
                self.session.add(new_sec)
                new_objects.append(((sym, srs), new_sec))

        if new_objects:
            self.session.flush()
            for key, obj in new_objects:
                mapping[key] = obj.id

        return mapping

    def search(self, query: str, limit: int = 50, distinct_symbols: bool = True) -> list[Security]:
        """Search securities by symbol or company name with priority for active equities and aliases."""
        q_upper = query.strip().upper()
        canonical_target = "ICICIBANK" if q_upper == "ICICI" else q_upper
        pattern = f"%{q_upper}%"
        stmt = (
            select(Security)
            .where(
                or_(
                    Security.symbol.like(pattern),
                    Security.company_name.like(pattern),
                    Security.isin.like(pattern),
                )
            )
            .order_by(
                case((Security.symbol == canonical_target, 0), (Security.symbol == q_upper, 1), else_=2),
                case((Security.series == "EQ", 0), else_=1),
                desc(Security.last_traded_date),
                asc(Security.symbol),
            )
            .limit(limit if not distinct_symbols else max(limit * 3, 200))
        )
        rows = list(self.session.execute(stmt).scalars().all())
        if not distinct_symbols:
            return rows

        # Deduplicate so each stock symbol appears exactly once (EQ series prioritized)
        seen_symbols: set[str] = set()
        deduped: list[Security] = []
        for s in rows:
            sym_key = s.symbol.strip().upper()
            if sym_key not in seen_symbols:
                seen_symbols.add(sym_key)
                deduped.append(s)
                if len(deduped) >= limit:
                    break
        return deduped

    def record_symbol_change(
        self,
        security_id: int,
        old_symbol: str,
        valid_from: date,
        valid_to: date | None = None,
        reason: str | None = None,
    ) -> SecuritySymbolHistory:
        """Records a historical symbol change for audit and longitudinal joins."""
        history = SecuritySymbolHistory(
            security_id=security_id,
            symbol=old_symbol.strip().upper(),
            valid_from=valid_from,
            valid_to=valid_to,
            change_reason=reason,
        )
        self.session.add(history)
        self.session.flush()
        return history
