"""Dashboard overview and market summary endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from nse_pipeline.api.dependencies import get_db
from nse_pipeline.services.market_summary import MarketSummaryService

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])


@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Retrieve market overview metrics, advances/declines, latest date and top movers."""
    service = MarketSummaryService(db)
    return service.get_market_overview()
