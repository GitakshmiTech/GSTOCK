"""Health check endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from nse_pipeline.database.session import get_db

router = APIRouter(tags=["Health"])


@router.get("/health")
@router.get("/api/v1/health")
def health_check():
    """Application health endpoint."""
    return {"status": "ok", "service": "nse_market_data_pipeline"}


@router.get("/health/database")
def database_health_check(db: Session = Depends(get_db)):
    """Database connectivity verification."""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unreachable: {e}")
