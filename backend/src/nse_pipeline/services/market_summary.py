"""Market Summary service for dashboard metrics, advances/declines and top movers."""

from datetime import date
from typing import Any, Dict, Optional

from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from nse_pipeline.core.logging import get_logger
from nse_pipeline.database.models import IngestionJob, Security, StockDailyHistory

logger = get_logger("services.market_summary")


class MarketSummaryService:
    def __init__(self, session: Session):
        self.session = session

    def get_market_overview(self) -> Dict[str, Any]:
        """Calculates market-wide overview metrics for the latest available trading date."""
        # 1. Find latest available trade date
        latest_date_stmt = select(func.max(StockDailyHistory.trade_date))
        latest_date: Optional[date] = self.session.execute(latest_date_stmt).scalar()

        # Total records across entire daily history
        total_records = self.session.execute(select(func.count(StockDailyHistory.id))).scalar() or 0
        total_securities = self.session.execute(select(func.count(Security.id))).scalar() or 0

        # Latest ingestion job status
        latest_job_stmt = select(IngestionJob).order_by(desc(IngestionJob.created_at)).limit(1)
        job = self.session.execute(latest_job_stmt).scalar_one_or_none()
        latest_job_info = None
        if job:
            latest_job_info = {
                "job_id": job.job_id,
                "job_type": job.job_type,
                "status": job.status,
                "total_rows": job.total_rows_imported,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            }

        if not latest_date:
            return {
                "latest_date": None,
                "total_securities_count": total_securities,
                "total_records_count": total_records,
                "traded_securities_count": 0,
                "advances": 0,
                "declines": 0,
                "unchanged": 0,
                "total_turnover": 0.0,
                "total_volume": 0,
                "top_gainers": [],
                "top_losers": [],
                "most_active": [],
                "latest_job": latest_job_info,
            }


        # 3. Fetch day's records joined with Security company name
        day_stmt = (
            select(StockDailyHistory, Security.company_name)
            .outerjoin(Security, StockDailyHistory.security_id == Security.id)
            .where(
                StockDailyHistory.trade_date == latest_date,
                StockDailyHistory.series == "EQ",
            )
        )
        day_records = list(self.session.execute(day_stmt).all())

        advances = 0
        declines = 0
        unchanged = 0
        total_turnover = 0.0
        total_volume = 0

        movers_list = []
        for r, company_name in day_records:
            close_p = float(r.close_price) if r.close_price is not None else 0.0
            prev_p = float(r.prev_close) if r.prev_close is not None else 0.0
            turnover_val = float(r.turnover) if r.turnover is not None else 0.0
            vol_val = int(r.traded_quantity) if r.traded_quantity is not None else 0

            total_turnover += turnover_val
            total_volume += vol_val

            if prev_p > 0:
                change_pct = round(((close_p - prev_p) / prev_p) * 100.0, 2)
            else:
                change_pct = 0.0
            change_val = round(close_p - prev_p, 2)

            if close_p > prev_p:
                advances += 1
            elif close_p < prev_p:
                declines += 1
            else:
                unchanged += 1

            movers_list.append({
                "symbol": r.symbol,
                "company_name": company_name or r.symbol,
                "series": r.series,
                "close_price": close_p,
                "prev_close": prev_p,
                "change": change_val,
                "change_pct": change_pct,
                "turnover": turnover_val,
                "volume": vol_val,
            })

        # Top gainers and losers (filter for active trading records where prev_close > 0)
        valid_movers = [m for m in movers_list if m["prev_close"] > 0 and m["close_price"] > 0]
        sorted_by_change = sorted(valid_movers, key=lambda x: x["change_pct"], reverse=True)
        top_gainers = sorted_by_change[:10]
        top_losers = sorted(valid_movers, key=lambda x: x["change_pct"])[:10]
        most_active = sorted(movers_list, key=lambda x: x["turnover"], reverse=True)[:10]

        # 4. Latest ingestion job status
        latest_job_stmt = select(IngestionJob).order_by(desc(IngestionJob.created_at)).limit(1)
        job = self.session.execute(latest_job_stmt).scalar_one_or_none()
        latest_job_info = None
        if job:
            latest_job_info = {
                "job_id": job.job_id,
                "job_type": job.job_type,
                "status": job.status,
                "total_rows": job.total_rows_imported,
                "started_at": job.started_at.isoformat() if job.started_at else None,
                "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            }

        return {
            "latest_date": latest_date.isoformat(),
            "total_securities_count": total_securities,
            "total_records_count": total_records,
            "traded_securities_count": len(day_records),
            "advances": advances,
            "declines": declines,
            "unchanged": unchanged,
            "total_turnover": round(total_turnover, 2),
            "total_volume": total_volume,
            "top_gainers": top_gainers,
            "top_losers": top_losers,
            "most_active": most_active,
            "latest_job": latest_job_info,
        }
